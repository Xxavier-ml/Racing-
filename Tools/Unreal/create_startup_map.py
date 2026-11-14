"""
Creates the project startup map inside Unreal Editor.

Unreal maps are binary assets and cannot be authored outside the editor, so this script
is the one manual step in Gate 1. It builds an empty Nairobi test level with lighting and
a player start; ANairobiRaceGameMode then greyboxes the circuit from the track data asset
at runtime.

Usage (Unreal Editor, Window > Output Log, Python console):
    py "<ProjectDir>/Tools/Unreal/create_startup_map.py"

After it runs, open /Game/Maps/L_NairobiTestTrack and press Play.
"""

import unreal

LEVEL_PATH = "/Game/Maps/L_NairobiTestTrack"


def ensure_level():
    if unreal.EditorAssetLibrary.does_asset_exist(LEVEL_PATH):
        unreal.log_warning(f"{LEVEL_PATH} already exists; opening it instead of overwriting.")
        unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(LEVEL_PATH)
        return

    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    level_subsystem.new_level(LEVEL_PATH)
    unreal.log(f"Created {LEVEL_PATH}")


def spawn(actor_class, location, rotation=(0.0, 0.0, 0.0), label=""):
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actor = subsystem.spawn_actor_from_class(
        actor_class,
        unreal.Vector(*location),
        unreal.Rotator(*rotation),
    )
    if actor and label:
        actor.set_actor_label(label)
    return actor


def build_scene():
    sun = spawn(unreal.DirectionalLight, (0.0, 0.0, 3000.0), (-42.0, 145.0, 0.0), "Sun_Nairobi")
    if sun:
        component = sun.get_component_by_class(unreal.DirectionalLightComponent)
        if component:
            component.set_intensity(3.14159 * 2.75)
            component.set_mobility(unreal.ComponentMobility.MOVABLE)

    sky_light = spawn(unreal.SkyLight, (0.0, 0.0, 1500.0), label="SkyLight_Nairobi")
    if sky_light:
        component = sky_light.get_component_by_class(unreal.SkyLightComponent)
        if component:
            component.set_intensity(1.0)
            component.set_real_time_capture(True)
            component.set_mobility(unreal.ComponentMobility.MOVABLE)

    atmosphere = spawn(unreal.SkyAtmosphere, (0.0, 0.0, 0.0), label="SkyAtmosphere_Nairobi")
    if atmosphere:
        unreal.log("Sky atmosphere added.")

    fog = spawn(unreal.ExponentialHeightFog, (0.0, 0.0, 0.0), label="HeightFog_Nairobi")
    if fog:
        component = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
        if component:
            component.set_fog_density(0.00135)
            component.set_fog_height_falloff(0.24)
            component.set_mobility(unreal.ComponentMobility.MOVABLE)

    # The game mode places racers on the migrated grid, so one player start is enough.
    spawn(unreal.PlayerStart, (5050.0, -16800.0, 150.0), (0.0, 90.0, 0.0), "PlayerStart_Spawn")

    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    level_subsystem.save_current_level()
    unreal.log(f"Saved {LEVEL_PATH}.")


ensure_level()
build_scene()
