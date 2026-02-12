import logging
import cv2

logger = logging.getLogger(__name__)


def load_face_detector():
    """Load OpenCV face detector"""
    try:
        # TODO: I think this requires opencv-contrib-python to be installed as
        # opposed to just opencv-python, verify and document installation steps.
        # Try to load Haar Cascade for face detection
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"  # type: ignore
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            logger.warning("Failed to load face cascade classifier")
            return None
        else:
            logger.info("Face detector loaded successfully")
            return face_cascade
    except Exception as e:
        logger.warning(f"Could not load face detector: {e}")
        return None
