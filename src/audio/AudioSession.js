import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import { EventEmitter } from 'node:events';
import { createSessionLogger } from '../utils/logger.js';
import { IcyMetadataReader } from '../sources/IcyMetadataReader.js';
import { ListeningStatsRepo } from '../database/db.js';

const RECONNECT_GRACE_MS = 5_000;
const RADIO_RESTART_DELAY_MS = 3_000;
const MAX_RADIO_RESTART_ATTEMPTS = 5;
const VOICE_READY_TIMEOUT_MS = 20_000;
const LISTENING_TICK_MS = 60_000;

/**
 * One AudioSession = one voice connection on one guild = one fully
 * independent radio playback state (own VoiceConnection, AudioPlayer,
 * current station, volume, pause state). AudioManager owns a map of these
 * keyed per guild; nothing here reaches into any other guild's session.
 *
 * This bot plays internet radio only — there is no queue, no track list,
 * no "next track". Switching stations simply replaces the current stream.
 *
 * Emits events the UI layer (embed/buttons) subscribes to:
 *   'stationStart', 'trackChange', 'error', 'destroyed'
 */
export class AudioSession extends EventEmitter {
  constructor({ guild, voiceChannel, textChannel }) {
    super();
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;

    this.station = null; // RadioSource | null — the currently selected station
    this.volume = 0.7; // 0..1, applied via inline volume transformer
    this.currentResource = null;
    this.currentTrackTitle = null; // latest ICY StreamTitle for the active station, if any
    this._radioRestartAttempts = 0;
    this._destroyed = false;
    this.trackAnnouncementMessage = null; // public "now playing" post, replaced on every track change
    this._metadataReader = null;
    this._sleepTimer = null;

    // Coarse (per-minute) listening-time tracking for the leaderboard.
    // Accumulates real-world minutes, not "seconds of audio decoded", so a
    // stalled/reconnecting stream doesn't inflate anyone's numbers.
    this._listeningInterval = setInterval(() => this._tickListening(), LISTENING_TICK_MS);

    this.log = createSessionLogger({
      guildId: guild.id,
      guildName: guild.name,
      voiceChannelId: voiceChannel.id,
    });

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      debug: true,
    });

    this.player = createAudioPlayer({
      behaviors: { noSubscriberBehavior: NoSubscriberBehavior.Pause },
    });
    this.connection.subscribe(this.player);

    this._bindConnectionEvents();
    this._bindPlayerEvents();
  }

  _bindConnectionEvents() {
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Distinguish a real disconnect from a transient blip (e.g. Discord
        // moving the bot between voice servers) before tearing everything down.
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, RECONNECT_GRACE_MS),
          entersState(this.connection, VoiceConnectionStatus.Connecting, RECONNECT_GRACE_MS),
        ]);
      } catch {
        this.log.warn('Voice connection lost, destroying session');
        this.destroy('voice-disconnected');
      }
    });

    this.connection.on('error', (err) => {
      this.log.error('Voice connection error', { error: err.message });
    });

    // Verbose diagnostic trail: if the connection stalls before Ready,
    // this shows exactly which step it never got past (UDP discovery,
    // selecting protocol, etc) instead of a silent 20s timeout.
    this.connection.on('stateChange', (oldState, newState) => {
      this.log.debug('Voice connection state change', { from: oldState.status, to: newState.status });
    });

    // Internal networking trail (WS handshake, IP discovery, encryption mode
    // selection). This is what actually shows *why* the connection stalls —
    // e.g. the voice websocket closing with a specific code, or IP discovery
    // never getting a reply because UDP is being dropped somewhere on the path.
    this.connection.on('debug', (message) => {
      this.log.debug(`[voice] ${message}`);
    });
  }

  _bindPlayerEvents() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      // Radio has no natural "end" — hitting Idle while a station is set
      // means the underlying ffmpeg process died (stream dropped hard).
      // Short blips are already absorbed by ffmpeg's own -reconnect flags;
      // landing here means we need to restart the process from scratch.
      if (this._destroyed || !this.station) return;
      this._restartRadio(this.station);
    });

    this.player.on('error', (err) => {
      this.log.error('AudioPlayer error', { error: err.message, station: this.station?.stationId });
      this.emit('error', err);
      if (!this._destroyed && this.station) this._restartRadio(this.station);
    });
  }

  /**
   * `source` pins this retry loop to the station it started for. Without
   * that, a retry scheduled for a station the user has since switched away
   * from (e.g. it kept failing and they picked a different one during the
   * delay below) would still fire, race the new station's own playStation()
   * call, and spawn a second concurrent ffmpeg/stream for it.
   */
  async _restartRadio(source) {
    if (this._destroyed || this.station !== source) return;

    this._radioRestartAttempts += 1;
    if (this._radioRestartAttempts > MAX_RADIO_RESTART_ATTEMPTS) {
      this.log.error('Radio stream failed repeatedly, giving up', { station: source.stationId });
      this.emit('error', new Error('Радиопоток недоступен после нескольких попыток переподключения.'));
      if (this.station === source) this.station = null;
      return;
    }

    this.log.warn('Radio stream dropped, reconnecting', {
      station: source.stationId,
      attempt: this._radioRestartAttempts,
    });

    await new Promise((r) => setTimeout(r, RADIO_RESTART_DELAY_MS));
    if (this._destroyed || this.station !== source) return;

    try {
      await this._playStation(source);
    } catch (err) {
      this.log.error('Radio reconnect attempt failed', { error: err.message });
      this._restartRadio(source);
    }
  }

  /** Switch to (or start) a station, replacing whatever is currently playing. */
  async playStation(radioSource) {
    this._radioRestartAttempts = 0;
    await this._playStation(radioSource);
  }

  async _playStation(source) {
    this.station = source;
    this._stopMetadataReader();
    this.currentTrackTitle = null;
    try {
      // Play only starts sending real audio once the voice connection has
      // actually finished its handshake (Ready). Calling player.play()
      // before that is a common silent-failure cause in @discordjs/voice:
      // no error is thrown, the bot just sits in the channel producing no
      // sound. Waiting here makes that failure mode loud instead of silent.
      await entersState(this.connection, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);

      const stream = await source.createStream();
      const resource = createAudioResource(stream, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resource.volume?.setVolume(this.volume);
      this.currentResource = resource;
      this.player.play(resource);
      this.log.info('Playback started', { station: source.stationId, title: source.title });
      this.emit('stationStart', source);

      // Best-effort: not every stream exposes ICY metadata, and this reader
      // runs over its own connection (ffmpeg's connection discards ICY data
      // entirely, so there's no way to get the title through it).
      this._metadataReader = new IcyMetadataReader(source.url, (title) => {
        if (this.station !== source) return; // stale reader from a replaced station
        this.currentTrackTitle = title;
        this.emit('trackChange', title);
      });
    } catch (err) {
      this.log.error('Failed to start radio stream', { error: err.message, station: source.stationId });
      this.emit(
        'error',
        // entersState's timeout rejects with a generic DOMException named
        // "AbortError" (message "The operation was aborted") — it never
        // mentions the target state, so that couldn't be matched on
        // err.message. This is the case where voice negotiation (usually
        // UDP IP discovery) never reaches Ready within VOICE_READY_TIMEOUT_MS.
        err.name === 'AbortError'
          ? new Error('Не удалось установить голосовое соединение с Discord (таймаут). Попробуйте ещё раз.')
          : err
      );
      this.station = null;
    }
  }

  pause() {
    return this.player.pause();
  }

  resume() {
    return this.player.unpause();
  }

  get isPaused() {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  setVolume(percent) {
    this.volume = Math.min(1, Math.max(0, percent / 100));
    this.currentResource?.volume?.setVolume(this.volume);
  }

  stop() {
    this.station?.destroy();
    this.station = null;
    this.currentTrackTitle = null;
    this._radioRestartAttempts = 0;
    this._stopMetadataReader();
    this.player.stop(true);
  }

  _stopMetadataReader() {
    this._metadataReader?.stop();
    this._metadataReader = null;
  }

  /** Leaves the channel automatically after `minutes`. Replaces any existing timer. */
  setSleepTimer(minutes) {
    this.clearSleepTimer();
    this._sleepTimer = setTimeout(
      () => {
        this.log.info('Sleep timer elapsed, leaving');
        this.destroy('sleep-timer');
      },
      minutes * 60_000
    );
  }

  /** Returns true if a timer was actually cancelled. */
  clearSleepTimer() {
    if (!this._sleepTimer) return false;
    clearTimeout(this._sleepTimer);
    this._sleepTimer = null;
    return true;
  }

  /** Credits every non-bot member currently in the channel with one tick of listening time. */
  _tickListening() {
    if (this._destroyed || !this.station || this.isPaused) return;
    const seconds = LISTENING_TICK_MS / 1000;
    for (const member of this.voiceChannel.members.values()) {
      if (member.user.bot) continue;
      ListeningStatsRepo.addSeconds(this.guild.id, member.id, seconds);
    }
  }

  destroy(reason = 'manual') {
    if (this._destroyed) return;
    this._destroyed = true;
    this.log.info('Destroying audio session', { reason });
    clearInterval(this._listeningInterval);
    this.clearSleepTimer();
    this._stopMetadataReader();
    this.station?.destroy();
    try {
      this.player.stop(true);
      this.connection.destroy();
    } catch {
      // Connection may already be gone (e.g. we're reacting to its own destroy).
    }
    this.emit('destroyed', reason);
  }
}
