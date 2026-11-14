using UnrealBuildTool;

public class NairobiRacing : ModuleRules
{
	public NairobiRacing(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		CppStandard = CppStandardVersion.Cpp20;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"ChaosVehicles",
			"Chaos",
			"Niagara",
			"UMG",
			"Slate",
			"SlateCore",
			"AudioMixer",
			"MetasoundEngine",
			"OnlineSubsystem",
			"OnlineSubsystemUtils",
			"Json",
			"JsonUtilities",
			"DeveloperSettings"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"ApplicationCore",
			"RenderCore",
			"RHI"
		});

		// Core/ contains deliberately engine-free, unit-testable simulation rules
		// (compiled by Tools/SimHarness outside Unreal as well).
		PublicIncludePaths.Add(ModuleDirectory);
	}
}
