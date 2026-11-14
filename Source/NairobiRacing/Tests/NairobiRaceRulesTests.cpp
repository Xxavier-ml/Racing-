#include "Misc/AutomationTest.h"

#include "Core/NairobiTrackRules.h"

#if WITH_DEV_AUTOMATION_TESTS

using namespace NairobiRacing::Core;

/**
 * Unreal automation coverage for the competitive rules.
 *
 * These mirror the standalone harness (Tools/SimHarness) so the same behaviour is
 * exercised both with and without an engine. Run in-editor with:
 *   Automation RunTests NairobiRacing
 */

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FNairobiCheckpointOrderingTest,
	"NairobiRacing.Race.CheckpointOrdering",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FNairobiCheckpointOrderingTest::RunTest(const FString& Parameters)
{
	const std::vector<FCheckpointDefinition> Gates = {
		FCheckpointDefinition{ 1, FVec2{ 0.0, 0.0 }, 10.0, false },
		FCheckpointDefinition{ 2, FVec2{ 100.0, 0.0 }, 10.0, false },
		FCheckpointDefinition{ 3, FVec2{ 100.0, 100.0 }, 12.0, true },
	};

	FRaceProgress Progress = CreateRaceProgress(1);
	Progress.RaceTimeSeconds = 5.0;

	TestTrue(TEXT("Skipping to the finish line is rejected"),
		SubmitCheckpoint(Progress, Gates, 3, FVec2{ 100.0, 100.0 }).Verdict == ECheckpointVerdict::RejectedWrongOrder);

	TestTrue(TEXT("First gate accepted"),
		SubmitCheckpoint(Progress, Gates, 1, FVec2{ 0.0, 0.0 }).Verdict == ECheckpointVerdict::AcceptedCheckpoint);

	TestTrue(TEXT("Duplicate gate rejected"),
		SubmitCheckpoint(Progress, Gates, 1, FVec2{ 0.0, 0.0 }).Verdict == ECheckpointVerdict::RejectedWrongOrder);

	TestTrue(TEXT("Out-of-range claim rejected"),
		SubmitCheckpoint(Progress, Gates, 2, FVec2{ -900.0, 0.0 }).Verdict == ECheckpointVerdict::RejectedOutOfRange);

	SubmitCheckpoint(Progress, Gates, 2, FVec2{ 100.0, 0.0 });
	Progress.RaceTimeSeconds = 61.0;
	const FCheckpointOutcome Finish = SubmitCheckpoint(Progress, Gates, 3, FVec2{ 100.0, 100.0 });

	TestTrue(TEXT("Finish accepted after all gates"), Finish.Verdict == ECheckpointVerdict::AcceptedRaceFinished);
	TestTrue(TEXT("Race marked finished"), Progress.bFinished);
	TestEqual(TEXT("Exactly one lap recorded"), static_cast<int32>(Progress.LapTimes.size()), 1);
	TestTrue(TEXT("Lap time matches server clock"), FMath::IsNearlyEqual(Finish.LapTimeSeconds, 56.0, 0.001));
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FNairobiStandingsTest,
	"NairobiRacing.Race.Standings",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FNairobiStandingsTest::RunTest(const FString& Parameters)
{
	std::vector<FStandingInput> Racers = {
		FStandingInput{ 1, 2, 3, true, 120.0, 0.0 },
		FStandingInput{ 2, 2, 3, true, 118.0, 0.0 },
		FStandingInput{ 3, 2, 3, false, 0.0, 42.0 },
		FStandingInput{ 4, 1, 1, false, 0.0, 8.0 },
		FStandingInput{ 5, 2, 3, false, 0.0, 11.0 },
	};

	const std::vector<int> Order = ComputeRacePositions(Racers);
	TestEqual(TEXT("Five racers classified"), static_cast<int32>(Order.size()), 5);
	TestEqual(TEXT("Fastest finisher is first"), Order[0], 2);
	TestEqual(TEXT("Second finisher is second"), Order[1], 1);
	TestEqual(TEXT("Closer car on the same lap is ahead"), Order[2], 5);
	TestEqual(TEXT("Last place is the least progressed"), Order[4], 4);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FNairobiLapPlausibilityTest,
	"NairobiRacing.Security.LapPlausibility",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FNairobiLapPlausibilityTest::RunTest(const FString& Parameters)
{
	TestFalse(TEXT("Zero lap rejected"), IsPlausibleLapTime(0.0, 1326.0, 64.0));
	TestFalse(TEXT("Impossibly fast lap rejected"), IsPlausibleLapTime(8.0, 1326.0, 64.0));
	TestTrue(TEXT("Realistic lap accepted"), IsPlausibleLapTime(95.0, 1326.0, 64.0));
	TestFalse(TEXT("Absurdly long lap rejected"), IsPlausibleLapTime(4000.0, 1326.0, 64.0));
	TestFalse(TEXT("Missing track length rejected"), IsPlausibleLapTime(95.0, 0.0, 64.0));
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FNairobiNitrousTest,
	"NairobiRacing.Vehicle.NitrousStateMachine",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ClientContext | EAutomationTestFlags::EngineFilter)

bool FNairobiNitrousTest::RunTest(const FString& Parameters)
{
	FNitroState Nitro;
	TestTrue(TEXT("Starts ready"), Nitro.Phase == ENitroPhase::Ready);

	StepNitro(Nitro, true, 0.1);
	TestTrue(TEXT("Activation enters Active"), Nitro.Phase == ENitroPhase::Active);
	TestTrue(TEXT("Thrusting while active"), IsNitroThrusting(Nitro));

	for (int32 Step = 0; Step < 35; ++Step)
	{
		StepNitro(Nitro, true, 0.1);
	}
	TestTrue(TEXT("Expires into Cooldown"), Nitro.Phase == ENitroPhase::Cooldown);
	TestFalse(TEXT("No thrust during cooldown"), IsNitroThrusting(Nitro));

	for (int32 Step = 0; Step < 60; ++Step)
	{
		StepNitro(Nitro, true, 0.1);
	}
	TestTrue(TEXT("Re-arms after cooldown"), Nitro.Phase == ENitroPhase::Ready);
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
