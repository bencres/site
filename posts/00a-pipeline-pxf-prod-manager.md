---
title: "Pixel Foundry Pipeline: Beginnings of the Environment/Production Manager"
category: "tech art"
date: "2025-12-22"
id: "ta-0007"
tags: ["software engineering", "python", "tech art", "pipeline", "pxf"]
excerpt: "Building the Pixel Foundry's environment launcher and production manager, allowing artists to launch their assigned task's environment."
---

I've begun working on our environment/production manager at PXF. Its purpose is to manage environment variables for individual assets and shots, and to allow artists to access their assigned tasks and projects. The general flow we're aiming for is:

1. Artist logs into the desktop application.
2. The desktop application queries our database for the artist's assigned tasks.
3. The artist selects one of their assigned tasks and the environment is launched, setting environment variables for the shot or asset they're working on.

We use Linear for our task management, Supabase for the backend, and PySide/PyInstaller for the desktop application; these choices are intentional, since our budget is very limited, and these services have great free plans.

Here's how it works:

1. Linear triggers an update to the database when a task is changed.
2. Supabase ingests the POST request sent by Linear.
3. Supabase updates the PostgreSQL database.
4. Supabase's realtime engine broadcasts the update to open web sockets.
5. The desktop client catches the update and refreshes the GUI.

The database has a bunch of tables, but the most important ones are shots, assets, and assignments. We delineate between shots (which compose sequences) and assets because we do a lot of photogrammetry work, so much of our artists' time is spent developing individual photogrammetry assets, rather than exclusively working on effects shots. Each individual assignment contains a lot of information, but the most important is that each is guaranteed to reference (using a foreign key, if you're familiar with SQL) either a shot or an asset, and is guaranteed to have an assignee (I'm wondering if it makes sense to allow assignee to be null, thus allowing us to create a separate 'unassigned task' list, but regardless this would be easy to implement later if the need arises).

Shots composes sequences, and sequences and assets compose projects.

Each shot and asset has its own `jsonb` (JSON binary) attribute for any external environment variables we want to introduce, along with our standard of:

- `$PROJ` - name of the project
- `$PROJPATH` - path of the project
- `$TASKPATH` - path to the task folder
- `$SHOT` - shot name
- `$SEQ` - sequence name
- `$ASSET` - asset name
- `$PATH` - for all project executable tools
- `$PYTHON_PATH` - for all project python scripts

which are generated dynamically from the table data.