using UnrealBuildTool;
using System.Collections.Generic;

public class NairobiRacingEditorTarget : TargetRules
{
	public NairobiRacingEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		CppStandard = CppStandardVersion.Cpp20;

		ExtraModuleNames.AddRange(new string[] { "NairobiRacing" });
	}
}
