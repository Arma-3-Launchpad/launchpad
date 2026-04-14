import os
import json
import random
from collections.abc import Callable
from typing import Any

try:
    from .thirdparty.a3lib import pbo
except ImportError:
    from thirdparty.a3lib import pbo

def generate_random_seed():
    return random.randint(1000000, 9999999)

def make_mission_pbo(
    mission_folder: str,
    *,
    output_pbo_path: str,
    progress_callback: Callable[[str], None] | None = None,
) -> str:
    """
    Pack a mission directory into a PBO at ``output_pbo_path``.

    The first argument to :func:`a3lib.pbo` is the output file path; source files
    are passed via ``files=[mission_folder]`` so the tree is included.
    """
    src = os.path.realpath(os.path.normpath(mission_folder))
    
    # build list of files to include in the PBO
    files = []
    # ignore .git directory and all its contents
    for root, dirs, _files in os.walk(src, topdown=True):
        # Prune in-place so os.walk does not descend into VCS metadata.
        if '.git' in dirs:
            dirs.remove('.git')
        if '.github' in dirs:
            dirs.remove('.github')

        # ignore .gitignore file
        if '.gitignore' in _files:
            _files.remove('.gitignore')

        # ignore .gitattributes file
        if '.gitattributes' in _files:
            _files.remove('.gitattributes')

        for file in _files:
            files.append(os.path.join(root, file))

    out = os.path.abspath(os.path.normpath(output_pbo_path))
    parent = os.path.dirname(out)
    if not parent:
        raise OSError("Invalid PBO output path (missing directory).")
    os.makedirs(parent, exist_ok=True)
    pbo(
        out,
        files=files,
        create_pbo=True,
        update_timestamps=True,
        recursion=True,
        pboprefixfile=False,
        include="*",
        exclude="",
        progress_callback=progress_callback,
    )
    return out


# literally can be anything between a file and a directory
# simple little utility class to build a recursive file tree
class FSNode:
    __slots__ = ('path', 'is_file', 'last_modified', 'size', 'content', 'children')
    def __init__(self, path: str, is_file: bool):
        self.path = path
        self.is_file = is_file
        self.last_modified = os.path.getmtime(path)
        self.size = os.path.getsize(path)
        self.content: bytes | None = None
        if is_file:
            with open(path, 'rb') as f:
                self.content = f.read()
        else:
            self.children: list[FSNode] = []
            for child in os.listdir(path):
                self.children.append(FSNode(os.path.join(path, child), os.path.isfile(os.path.join(path, child))))
    def __dict__(self):
        return {
            'path': os.path.relpath(self.path, dir),
            'is_file': self.is_file,
            'last_modified': self.last_modified,
            'size': self.size,
            'content': self.content,
            'children': [child.__dict__() for child in self.children],
        }

def build_recursive_file_tree_json(dir: str) -> str:
    """
    Build a JSON object representing the file tree of the given directory.
    """
    tree: dict[str, Any] = {}
    for root, dirs, files in os.walk(dir):
        node = FSNode(root, os.path.isdir(root))
        for file in files:
            node.children.append(FSNode(os.path.join(root, file), True))
        tree[os.path.relpath(root, dir)] = node.__dict__()
    return json.dumps(tree)