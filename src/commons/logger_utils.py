import logging


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Helper function to get a logger with the specified name and standard formatting"""
    logging.basicConfig(
        level=level,
        format="%(asctime)s: %(levelname)s: %(name)s: %(message)s",
    )
    return logging.getLogger(name)
