import queue
import numpy as np

# This file was stolen from daphbot_due
# https://github.com/littlebee/daphbot-due/blob/main/src/commons/audio_stream_player.py
# TODO : consider moving this whole file and class to basic_bot.commons

from basic_bot.commons import log, constants as c

# sounddevice won't work in CI/CD pipeline where there is no audio hardware
if c.BB_ENV != "test":
    import sounddevice as sd

    if c.BB_LOG_DEBUG:
        default_output_device_info = sd.query_devices(sd.default.device[1], "output")
        log.debug(
            f"audio_stream_player: Default output device: {default_output_device_info}"
        )
else:
    log.info(
        "Running in BB_ENV='test', stubbing out sounddevice for audio_stream_player"
    )

    class SoundDeviceMock:
        class OutputStream:
            def __init__(self, *args, **kwargs):
                pass

            def start(self):
                pass

            def stop(self):
                pass

            def close(self):
                pass

    sd = SoundDeviceMock()


class AudioStreamPlayer:

    def __init__(self):
        # Audio playback setup
        self.audio_queue: queue.Queue[np.ndarray] = queue.Queue(maxsize=5)  # Small buffer for low latency
        self.audio_stream = None
        self.audio_thread = None

    async def setup_audio_stream(self, first_frame):
        """Setup sounddevice audio stream based on first audio frame."""
        try:
            # Get audio properties from the frame
            sample_rate = first_frame.sample_rate
            channels = (
                len(first_frame.layout.channels)
                if hasattr(first_frame, "layout")
                else 1
            )

            log.info(f"Setting up audio stream: {sample_rate}Hz, {channels} channels")

            # Create audio stream with callback
            self.audio_stream = sd.OutputStream(
                samplerate=sample_rate,
                channels=channels,
                dtype=np.int16,
                callback=self._audio_callback,
                blocksize=1024,  # Small buffer for low latency
                latency=0.01,  # Very low latency (10ms)
            )

            self.audio_stream.start()
            log.info("Audio stream started successfully")

        except Exception as e:
            log.error(f"Error setting up audio stream: {e}")

    def _audio_callback(self, outdata, frames, time, status):
        """Callback function for sounddevice audio stream."""
        if status:
            log.debug(f"Audio callback status: {status}")

        try:
            # Get audio data from queue
            audio_data = self.audio_queue.get_nowait()

            # Ensure data fits in output buffer - reshape for stereo output
            if len(audio_data) <= len(outdata) * 2:
                # Reshape interleaved stereo data to (samples, 2)
                stereo_samples = len(audio_data) // 2
                stereo_data = audio_data[: stereo_samples * 2].reshape(-1, 2)
                outdata[:stereo_samples] = stereo_data
                # Pad with zeros if needed
                if stereo_samples < len(outdata):
                    outdata[stereo_samples:] = 0
            else:
                # Truncate if too long - take only what fits in output buffer
                needed_samples = len(outdata) * 2
                outdata[:] = audio_data[:needed_samples].reshape(-1, 2)

        except queue.Empty:
            # No audio data available, output silence
            outdata.fill(0)
        except Exception as e:
            log.error(f"Error in audio callback: {e}")
            outdata.fill(0)

    def queue_audio_frame(self, frame):
        """Convert and queue audio frame for playback."""
        try:
            # Convert WebRTC frame to numpy array
            audio_data = np.frombuffer(frame.to_ndarray().tobytes(), dtype=np.int16)

            # Add to queue (drop old frames if queue is full)
            try:
                self.audio_queue.put_nowait(audio_data)
            except queue.Full:
                # Remove oldest frame and add new one
                try:
                    self.audio_queue.get_nowait()
                    self.audio_queue.put_nowait(audio_data)
                except queue.Empty:
                    pass

        except Exception as e:
            log.error(f"Error queuing audio frame: {e}")

    def cleanup_audio_stream(self):
        """Clean up audio stream resources."""
        try:
            if self.audio_stream:
                self.audio_stream.stop()
                self.audio_stream.close()
                self.audio_stream = None
                log.info("Audio stream cleaned up")

            # Clear audio queue
            while not self.audio_queue.empty():
                try:
                    self.audio_queue.get_nowait()
                except queue.Empty:
                    break

        except Exception as e:
            log.error(f"Error cleaning up audio stream: {e}")
