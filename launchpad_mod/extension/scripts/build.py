import sys
import os
import shutil
from invoker import invoke

current_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(current_dir, "..", "..")
extension_debug_dir = os.path.join(repo_root, "extension", "out", "build", "x64-debug")
extension_release_dir = os.path.join(repo_root, "extension", "out", "build", "x64-release")

BIN_PATH = sys.argv[1] if len(sys.argv) > 1 else extension_debug_dir
CWD = os.getcwd()

if os.name == "nt":
    print("Windows")
    DEPS = ["A3_LAUNCHPAD_EXT_x64.dll"]
else:
    print("Unix")
    DEPS = ["A3_LAUNCHPAD_EXT_x64.so"]

"""
for dep in DEPS:
    bin_path = os.path.normpath(os.path.join(BIN_PATH, dep))
    cmd = f"cp '{bin_path}' '{out_path}'"
    print (f"[->] {cmd}")
    os.system(cmd)
    
    if "ADKF" in dep:
        continue
    
    cmd2 = f"cp '{bin_path}' '{a3_path}'"
    print (f"[->] {cmd2}")
    os.system(cmd2)
"""
BINARY_RUNTIME_PATH = r"X:\Storage\Steam\steamapps\common\Arma 3"
shutil.copy(os.path.join(BIN_PATH, "A3_LAUNCHPAD_EXT_x64.dll"), os.path.join(BINARY_RUNTIME_PATH, "A3_LAUNCHPAD_EXT_x64.dll"))

print ("[+BUILD+] Build complete")

dll_path = os.path.join(BINARY_RUNTIME_PATH, "A3_LAUNCHPAD_EXT_x64.dll")
if invoke(dll_path, "healthCheck", '{"client":"build.py"}'):
    print("healthCheck OK")
else:
    print("healthCheck failed")