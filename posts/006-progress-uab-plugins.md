---
title: "Universal Asset Browser Progress Update: Plugins, External Libraries, and the Registry Pattern"
category: "tech art"
date: "2025-12-31"
id: "ta-0006"
tags: ["software engineering", "python", "tech art", "uab"]
excerpt: "Adding a plugin system using the registry pattern, allowing the integration of third-party asset libraries."
---

One of the core features of the UAB is the ability to access external asset libraries, not only a user's own local assets. To accomplish this, I've used the registry pattern to create a plugin system, allowing me to integrate libraries like PolyHaven (thanks to Greg Zaal!) and create a way for other developers to extend the UAB with their own asset libraries, whether it be a large commerical service or an internal library. Asset libraries are only the first kind of plugin; more to come in the future!

# The Registry Pattern

There are three main parts of the registry pattern.

1. The Registry: typically (more on this later) a singleton or global object that stores a list of available plugins.
2. The Provider: a module that extends the functionality of the application which registers itself with the registry.
3. The Consumer: the part of the application that accesses the plugin. In this case, that's the GUI which adds a tab to the browser for each registered external library.

It works by:

1. Scanning the `plugins` directory.
2. Importing the contents of each file in the directory.
3. On import, `Registry.register` is called for the module.
4. `Registry.register` validates the plugin, ensuring that it conforms to the `Plugin` interface and any relevant child interfaces.
5. When the rest of the application is initialized, it queries the registry for all valid plugins and handles instantiation accordingly.

## Conceptual Implementation

```python
class AssetLibraryRegistry:
    _libraries = []

    @classmethod
    def register(cls, library_class):
        """Third parties call this to add their library."""
        cls._libraries.append(library_class)

    @classmethod
    def get_all_libraries(cls):
        return cls._libraries
```

There are a few interesting things to note here:
- `_libraries` is "Python private", so is of course not technically private, but is denoted as private with the prepended underscore. This list of plugins should not be accessed outside of the provided methods to access it.
- `@classmethod` marks the method as a class method (obviously), but the distinction that I want to point out here is why a class method and *not* a static method. And actually, having written this, I'm gonna dive into another subheading here, since it's long and deserves it. 

### Class Methods versus Static Methods

The question here is one of extensibility. Both are attached to the class itself, but class methods have access to the current state of the passed class, while static methods don't. This probably sounds like esoteric mumbo-jumbo, so let's look at an example. 

The static method way: 

```python
class Registry:
    plugins = []

    @staticmethod
    def register(plugin):
        # We have to explicitly name 'AssetRegistry' here
        Registry.plugins.append(plugin)
```

The class method way:

```python
class Registry:
    plugins = []

    @classmethod
    def register(cls, plugin):
        # 'cls' refers to whatever class called this method
        cls.plugins.append(plugin)
```

The problem with the static approach is that it has the same logic in every context. In the example above, it will always only ever append to `plugins` in `AssetRegistry`. But, crucially, this application will eventually support multiple kinds of plugins. The first kind right now is asset libraries, but extra context menu actions and other convenience plugins will be supported in the future, so it makes sense to have a base `Registry` and subclasses like `AssetLibraryRegistry`, `ContextActionRegistry`, etc. as otherwise accessing a specific kind of plugin would require looping through the list of plugins and checking the type of each plugin (like when rendering a browser tab for each external library, we could either access the `AssetLibraryRegistry` directly, or iterate through all `plugins` in `Registry` and check if each one is an external library). This way is extensible, allowing any kind of plugin to be added and accessed intentionally. 

The class method approach allows the logic for registration to live in the base `Registry` class, but the data for each registry to live in that specific class, which is why a class reference is passed as the first argument to the register method; this way, it knows which specific class is calling it.

### `__init_subclass__`

We can take this a step further and automatically register plugins that subclass `Registry`, rather than having to manually call a registration method. Python has a dunder method `__init_subclass__`, which is called by a parent class every time a new class inherits it. This allows us to move the responsibility for registration away from the developer, and instead directly to the parent `Registry` class, as all registries will inherit it. Check out this example:

```python
# Registry
class BaseRegistry:
    """Abstract storage for plugins"""
    _plugins = []

    @classmethod
    def register(cls, plugin_cls):
        cls._plugins.append(plugin_cls)
        print(f"[{cls.__name__}] Registered: {plugin_cls.__name__}")

    @classmethod
    def get_all(cls):
        return cls._plugins

# Specialized Registries
class AssetLibraryRegistry(BaseRegistry):
    _plugins = [] # re-declare list so it doesn't share with Parent

class ActionRegistry(BaseRegistry):
    _plugins = [] 

# Plugins
class BasePlugin:
    """The Interface"""
    # Each base plugin type must declare which Registry it belongs to
    target_registry = None 

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        
        # Guard for anything that doesn't specify a registry
        if cls.target_registry is None:
            return

        cls.target_registry.register(cls)

# Individual Plugin Types
class AssetLibraryPlugin(BasePlugin):
    target_registry = AssetLibraryRegistry
    # Abstract methods

class ContextActionPlugin(BasePlugin):
    target_registry = ActionRegistry
    # Abstract methods

# Plugin implementations
class PolyHaven(AssetLibraryPlugin):
    pass

class SendToUnreal(ContextActionPlugin):
    pass
```

And now, finally, we can get to my implementaion (well, a very simplified version of it). You might notice that the above is a bit much, unless registries need a bunch of their own functionality (which I don't foresee), as the registries are basically just wrappers for a list of a specific type of plugin. As such, I moved the registries directly into the abstract plugin.

```python
from abc import ABC, abstractmethod
import inspect

# Abstract Plugin base class
class Plugin(ABC):
    """
    The abstract root. Inheriting from ABC allows us to use @abstractmethod.
    """
    @property
    @abstractmethod
    def name(self) -> str:
        """The display name of the plugin"""
        pass

# Category of plugin, stores its own registry
class AssetLibraryPlugin(Plugin):
    _registry = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        
        # Guard for any children abstract classes
        if inspect.isabstract(cls):
            return
            
        cls._registry.append(cls)

    # Every implementation must provide a widget
    @abstractmethod
    def get_widget(self):
        """Must return a QWidget (or equivalent) for the tab content"""
        pass

# Implementation
class PolyHaven(AssetLibraryPlugin):
    name = "PolyHaven Assets"
    
    def get_widget(self):
        return SomeWidget() 
```

Once plugins are implemented across the application (for toolbar widgets, context actions, asset libraries, etc.), the application will be much more extensible, and much *easier* for other developers to add more functionality to. I'm working on that refactor now! Then on to more work on supporting textures and materials.