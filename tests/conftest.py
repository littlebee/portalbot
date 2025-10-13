# import sys
import os

os.environ["BB_ENV"] = "test"
os.environ["BB_HUB_PORT"] = "5150"


# enables import of helpers, like `import helpers.central_hub as hub`
# sys.path.append(os.path.dirname(__file__))

# # enables import of main source like commons
# src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../src"))
# sys.path.append(src_path)
