# Installation Instructions

This document will guide you through setting up the development environment for Python and how to use the portable binary of the application.

## Python Development Setup

1. **Prerequisites**: Ensure you have Python 3.8+ installed on your machine. You can download it from [python.org](https://www.python.org/downloads/).
2. **Clone the Repository**: Run the following command to clone the repo to your local machine.
   ```bash
   git clone https://github.com/a3r0id/a3-mission-launchpad.git
   cd a3-mission-launchpad
   ```
3. **Create a Virtual Environment**: It’s recommended to use a virtual environment. You can create one using:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
4. **Install Dependencies**: Once the virtual environment is activated, install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. **Run the Application**: You can start the application with:
   ```bash
   python launchpad
   ```

## Portable Binary Usage

For users who prefer not to set up a development environment, a portable binary is available.

> [!IMPORTANT]
> The packaged binary simply uses [PyInstaller](https://pyinstaller.org/en/stable/) to build a portable, Python-based executable. The executable is not signed and WILL cause the program to be flagged by your antivirus as unsafe. If you prefer to build your own portable executable then you can follow the steps to package your own executable.

**Install from GitHub**

1. Clone the repo or download it as an archive via the github website.

2. Jump into the repo directory and run the install helper. *This will simply attempt to make a link from your desktop to the current binary's location*
   
   Windows
   ```bash
   cd a3-mission-launchpad
   python package.py install-desktop
   ```

   Linux/MacOS
   ```bash
   cd a3-mission-launchpad
   python3 package.py install-desktop
   ```

**Build your own executable**

1. Clone the repo or download it as an archive via the github website.

2. Jump into the repo directory then run the packaging CLI

   Windows
   ```bash
   cd a3-mission-launchpad
   python package.py build
   ```

   Linux/MacOS
   ```bash
   cd a3-mission-launchpad
   python3 package.py build
   ```
   
---

Feel free to reach out if you encounter any issues or have questions!
