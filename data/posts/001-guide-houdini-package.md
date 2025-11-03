---
title: "Houdini 21: How to Create a Package"
category: "tech art"
date: "01-11-2025"
id: "ta-0001"
tags: ["houdini", "python", "tech art"]
excerpt: "A quick guide to creating a Houdini package in Houdini 21 with a custom Python library and Python panel."
---

Check out the template [here](https://github.com/bencres/houdini-package-template).

---

There are a bunch of different ways to create one; what I'm going to show here is the easiest for one individual user. You can check out SideFX's [Houdini Package documentation](https://www.sidefx.com/docs/houdini/ref/plugins.html) for more detailed information.

1. Navigate to `$HOUDINI_USER_PREF_DIR`, a [Houdini environment variable](https://www.sidefx.com/docs/houdini/ref/env.html) and create a `packages` directory if it doesn't already exist.

> Windows: C:\Users\<your username>\Documents\houdini<version>

> MacOS: ~/Library/Preferences/houdini/<version>

2. Create a directory to hold your package in the `packages` directory. Name it whatever you want your package to be named. I'll use `my_package`.

3. Create a `my_package.json` file, named the same as your package directory/package name, and copy/paste the following in, changing `my_package` to whatever your package is named:

```json
{
  "hpath": "$HOUDINI_USER_PREF_DIR/packages/my_package"
}
```

When Houdini is starting, it will search `$HOUDINI_USER_PREF_DIR/packages` for `.json` files and modify `$HOUDINI_PATH` as described within them. In this case, all we're doing is letting Houdini know that it needs to look in `my_package` for stuff, along with its own installation.

4. Add whatever contents you need to your tool. What we'll do in this guide is set up a Python panel that talks to a custom Python library. Inside your package, create two directories: `python3.11libs` and `python_panels`. Note that these must match the naming conventions in `$HFS/houdini`, so HDA's need to go in an `otls` directory, shelves must go in `toolbar`, etc.

5. In `python3.11libs`, create a directory named `my_lib`. Add an empty `__init__.py` file and `my_script.py`, with the following contents:

```python
def hello_world():
    return "Hello, world!"
```

6. In Houdini, go to Window > Python Panel Editor > New Interface.
    - Save To: wherever your package is / python_panels, ex "/Users/Ben/Library/Preferences/packages/my_package/python_panels/my_panel.pypanel"
    - Name: my_interface
    - Label: My Interface
    - Check "Include in Pane Tab Menu"
    - Check "Create Preceding Separator"
    - Hit Apply
    - Hit Accept
    - Quit Houdini

7. You should now have a `.pypanel` file that looks something like this (likely your default script is a little different):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pythonPanelDocument>
  <!-- This file contains definitions of Python interfaces and the
 interfaces menu.  It should not be hand-edited when it is being
 used by the application.  Note, that two definitions of the
 same interface or of the interfaces menu are not allowed
 in a single file. -->
  <interface name="my_interface" label="My Interface" icon="MISC_python" showNetworkNavigationBar="false" help_url="">
    <script><![CDATA[########################################################################
########################################################################
# Replace the sample code below with your own to create a
# PySide interface.  Your code must define an
# onCreateInterface() function that returns the root widget of
# your interface.
#
# The 'hutil.PySide' is for internal-use only.
#
# When developing your own Python Panel, import directly from PySide
# instead of from 'hutil.PySide'.
########################################################################

#
# SAMPLE CODE
#
from hutil.PySide import QtWidgets

def onCreateInterface():
    widget = QtWidgets.QLabel('Hello World!')
    return widget

]]></script>
    <includeInPaneTabMenu menu_position="0" create_separator="true"/>
    <includeInToolbarMenu menu_position="201" create_separator="false"/>
    <help><![CDATA[]]></help>
  </interface>
</pythonPanelDocument>
```

8. Copy/paste this into the script section to replace the current contents, so your new file looks something like this:

```python
from PySide6 import QtWidgets
from my_houdini_lib import my_script

def onCreateInterface():
    # Must return the root QtWidget of your pane.
    widget = QtWidgets.QLabel(my_script.hello_world())
    return widget
```

---

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pythonPanelDocument>
  <!-- This file contains definitions of Python interfaces and the
 interfaces menu.  It should not be hand-edited when it is being
 used by the application.  Note, that two definitions of the
 same interface or of the interfaces menu are not allowed
 in a single file. -->
  <interface name="my_interface" label="My Interface" icon="MISC_python" showNetworkNavigationBar="false" help_url="">
    <script><![CDATA[
from PySide6 import QtWidgets
from my_houdini_lib import my_script

def onCreateInterface():
    # Must return the root QtWidget of your pane.
    widget = QtWidgets.QLabel(my_script.hello_world())
    return widget
]]></script>
    <includeInPaneTabMenu menu_position="0" create_separator="true"/>
    <includeInToolbarMenu menu_position="212" create_separator="false"/>
    <help><![CDATA[]]></help>
  </interface>
</pythonPanelDocument>

```

9. Open Houdini and in the menu for a new pane, you'll see "My Interface". It displays a label that says "Hello, world!".

Now you can write whatever Python logic you'd like in your library and build a UI to interact with it.
