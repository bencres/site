---
title: "Universal Asset Browser Progress Update: Assets as Objects"
category: "tech art"
date: "2025-12-11"
id: "ta-0005"
tags: ["software engineering", "python", "tech art", "uab"]
excerpt: "Refactoring the application to use the new Asset object and its subclasses, rather than passing dictionaries around."
---

This week, the Universal Asset Browser was refactored to use proper object-oriented design for assets, moving away from the dictionary-based approach that had been used throughout the application. This change sets the foundation for better type safety, more maintainable code, and support for features like LODs (Levels of Detail) and asset collections.

# The Old Approach: Dictionaries Everywhere

Previously, assets were represented as dictionaries throughout the application. When an asset was fetched from the database, it was returned as a dictionary with keys like `id`, `name`, `path`, `file_type`, `description`, `tags`, etc. This dictionary was then passed around between the server, presenter, and GUI layers, with each layer accessing values using dictionary keys.

While this worked, it had several drawbacks:

1. **No type safety**: There was no way to guarantee that a dictionary contained the expected keys, or that those keys had the correct types.
2. **No encapsulation**: Any part of the codebase could modify the dictionary in unexpected ways.
3. **No helper methods**: Common operations like getting a display name or checking if an asset was an HDRI required repetitive dictionary access patterns scattered throughout the code.
4. **Difficult to extend**: Adding new asset types or behaviors meant modifying dictionary access code in multiple places.

# The New Approach: Asset Objects and Subclasses

The new design centers around a base `Asset` class that encapsulates all asset data and provides helper methods for common operations. Asset types are represented as subclasses, allowing for type-specific behavior while maintaining a common interface.

## Base Asset Class

The `Asset` base class stores all the core asset data that was previously in dictionaries:

```python
class Asset:
    def __init__(self, id, name, path, file_type, description=None, 
                 tags=None, author=None, creation_date=None, date_added=None):
        self.id = id
        self.name = name
        self.path = path
        self.file_type = file_type
        self.description = description or ""
        self.tags = tags or []
        self.author = author
        self.creation_date = creation_date
        self.date_added = date_added
```

This immediately provides better structure than dictionaries, but the real power comes from the helper methods.

## Helper Methods

Helper methods encapsulate common operations that were previously scattered throughout the codebase. For example:

- `get_display_name()`: Returns a human-readable name, falling back to the filename if no name is set.
- `to_dict()`: Converts the asset to a dictionary for serialization (useful for API responses).
- `from_dict()`: Class method to create an asset from a dictionary (useful for deserializing database results).

These methods eliminate repetitive code and provide a single source of truth for asset operations. Instead of writing `asset_dict.get('name') or os.path.basename(asset_dict.get('path', ''))` in multiple places, the code now uses `asset.get_display_name()`.

## Asset Subclasses

Different asset types have different behaviors and requirements. HDRI assets, for example, might need LOD support, while material assets might need texture mapping information to support LOD's with collections of individual textures, which may need to support artistic texture variants (material, material_rusted, material_painted, etc.). Subclasses allow `Asset` to be extended with type-specific functionality. This design makes it easy to add new asset types in the future (materials, models, animations) without modifying existing code. Each asset type can have its own specialized methods while still being usable anywhere an `Asset` is expected.

# LOD Support

One of the key motivations for this refactoring was to properly support LODs (Levels of Detail) for assets. In the dictionary-based approach, LOD information would have been just another key-value pair, with no way to enforce relationships between LODs of the same asset or validate LOD values.

With the object-oriented approach, LOD support is built into the asset hierarchy:

1. **LOD as a property**: Assets that support LODs (like HDRIs) can have an `lod` property that stores the LOD level.
2. **LOD validation**: The `HDRIAsset` class can validate that LOD values are valid ("low", "medium", "high", or "LOD0", "LOD1", etc.).
3. **LOD collections**: `Texture` objects support collections of LOD's, which will soon be extended to support variants of textures as well.

For now, LODs are stored as a simple property, but the architecture is in place to support more sophisticated LOD management as the feature evolves.

# Migration Challenges

Refactoring from dictionaries to objects across the entire codebase was a significant undertaking. The main challenges were:

1. **API compatibility**: The server's REST API still needs to return JSON (dictionaries), so assets need to be serializable. The `to_dict()` method handles this, but it required careful attention to ensure all necessary fields are included.

2. **Database layer**: The database layer returns dictionaries from SQL queries. The `from_dict()` class method handles conversion, but had to be verified to ensure it works correctly with all the different query results throughout the application, and the 

3. **Type checking**: Python's dynamic typing means there's no compile-time type checking, but using classes instead of dictionaries makes the code more self-documenting and easier to reason about.

4. **Backward compatibility**: During the transition, all asset-accessing parts of the codebase still expected dictionaries. All dictionary access patterns needed to be updated to use the new object interface.

# Next Steps

With the object model in place, the next steps I'm considering are:

1. **Collections**: As mentioned in the previous update, collections will group related assets, for LOD's, texture variants, and materials. 

2. **PolyHaven support**: With collections implemented, PolyHaven support can begin.

3. **Type-specific behaviors**: As support is added for materials and models, their subclasses can implement type-specific methods (e.g., `MaterialAsset.get_texture_maps()` or `ModelAsset.get_mesh_info()`).

This refactoring represents a significant improvement in code quality and maintainability, and it sets the foundation for planned features.

