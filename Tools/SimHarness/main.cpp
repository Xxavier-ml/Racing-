// Standalone verification harness for NairobiRacing::Core.
//
// Compiles the engine-free race rules with a plain C++20 compiler, so competitive
// logic (checkpoint ordering, standings, lap-time plausibility, ghosts, leaderboards,
// lane geometry, signals, nitrous, coordinate conversion) is verified on machines
// without Unreal Engine. The Unreal module links the exact same .cpp.
//
// Run: Tools/SimHarness/run_tests.sh

#include "Core/NairobiTrackRules.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

using namespace NairobiRacing::Core;

namespace
{
	int GFailures = 0;
	int GChecks = 0;

	void Check(bool bCondition, const char* Expression, const char* File, int Line)
	{
		++GChecks;
		if (!bCondition)
		{
			++GFailures;
			std::printf("  FAIL %s:%d  %s\n", File, Line, Expression);
		}
	}

	void CheckNear(double Actual, double Expected, double Tolerance, const char* Expression, const char* File, int Line)
	{
		++GChecks;
		if (!(std::fabs(Actual - Expected) <= Tolerance))
		{
			++GFailures;
			std::printf("  FAIL %s:%d  %s  (actual %.6f, expected %.6f +/- %.6f)\n",
				File, Line, Expression, Actual, Expected, Tolerance);
		}
	}

#define CHECK(Expr) Check((Expr), #Expr, __FILE__, __LINE__)
#define CHECK_NEAR(Actual, Expected, Tolerance) CheckNear((Actual), (Expected), (Tolerance), #Actual " ~= " #Expected, __FILE__, __LINE__)
#define TEST(Name) void Name(); struct FRegister_##Name { FRegister_##Name() { std::printf("[ RUN  ] %s\n", #Name); Name(); } } GRegister_##Name; void Name()

	constexpr double Pi = 3.14159265358979323846;

	std::vector<FCheckpointDefinition> MakeThreeGateTrack()
	{
		return {
			FCheckpointDefinition{ 1, FVec2{ 0.0, 0.0 }, 10.0, false },
			FCheckpointDefinition{ 2, FVec2{ 100.0, 0.0 }, 10.0, false },
			FCheckpointDefinition{ 3, FVec2{ 100.0, 100.0 }, 12.0, true },
		};
	}

	TEST(BasicMath)
	{
		CHECK_NEAR(Distance2D(FVec2{ 0.0, 0.0 }, FVec2{ 3.0, 4.0 }), 5.0, 1e-9);
		CHECK_NEAR(NormalizeAngleRadians(0.0), 0.0, 1e-9);
		CHECK_NEAR(std::fabs(NormalizeAngleRadians(3.0 * Pi)), Pi, 1e-6);
		CHECK_NEAR(std::fabs(NormalizeAngleRadians(-3.0 * Pi)), Pi, 1e-6);
		CHECK_NEAR(NormalizeAngleRadians(0.0 / 0.0), 0.0, 1e-9);
	}

	TEST(CheckpointsMustBeClearedInOrder)
	{
		const std::vector<FCheckpointDefinition> Gates = MakeThreeGateTrack();
		FRaceProgress State = CreateRaceProgress(1);
		State.RaceTimeSeconds = 5.0;

		// Gate 3 is the finish line: it cannot be taken first.
		FCheckpointOutcome Skipped = SubmitCheckpoint(State, Gates, 3, FVec2{ 100.0, 100.0 });
		CHECK(Skipped.Verdict == ECheckpointVerdict::RejectedWrongOrder);
		CHECK(!Skipped.bAccepted);
		CHECK(State.NextCheckpointIndex == 0);

		FCheckpointOutcome First = SubmitCheckpoint(State, Gates, 1, FVec2{ 1.0, 0.0 });
		CHECK(First.Verdict == ECheckpointVerdict::AcceptedCheckpoint);
		CHECK(State.NextCheckpointIndex == 1);

		// Replaying an already-cleared gate must not advance progress again.
		FCheckpointOutcome Duplicate = SubmitCheckpoint(State, Gates, 1, FVec2{ 0.0, 0.0 });
		CHECK(Duplicate.Verdict == ECheckpointVerdict::RejectedWrongOrder);
		CHECK(State.NextCheckpointIndex == 1);

		FCheckpointOutcome Unknown = SubmitCheckpoint(State, Gates, 99, FVec2{ 0.0, 0.0 });
		CHECK(Unknown.Verdict == ECheckpointVerdict::RejectedUnknownGate);

		// Remote client claiming gate 2 while still 500 m away is rejected.
		FCheckpointOutcome Spoofed = SubmitCheckpoint(State, Gates, 2, FVec2{ -500.0, 0.0 });
		CHECK(Spoofed.Verdict == ECheckpointVerdict::RejectedOutOfRange);
		CHECK(State.NextCheckpointIndex == 1);

		FCheckpointOutcome Second = SubmitCheckpoint(State, Gates, 2, FVec2{ 100.0, 0.0 });
		CHECK(Second.Verdict == ECheckpointVerdict::AcceptedCheckpoint);
		CHECK(State.NextCheckpointIndex == 2);

		State.RaceTimeSeconds = 75.5;
		FCheckpointOutcome Finish = SubmitCheckpoint(State, Gates, 3, FVec2{ 100.0, 100.0 });
		CHECK(Finish.Verdict == ECheckpointVerdict::AcceptedRaceFinished);
		CHECK(Finish.bRaceFinished);
		CHECK(State.bFinished);
		CHECK(State.LapsCompleted == 1);
		CHECK(State.LapTimes.size() == 1);
		CHECK_NEAR(Finish.LapTimeSeconds, 75.5, 1e-9);
		CHECK_NEAR(State.BestLapSeconds, 75.5, 1e-9);

		// A finished race accepts nothing further.
		FCheckpointOutcome AfterFinish = SubmitCheckpoint(State, Gates, 1, FVec2{ 0.0, 0.0 });
		CHECK(AfterFinish.Verdict == ECheckpointVerdict::RejectedRaceInactive);
	}

	TEST(MultiLapProgressAndBestLap)
	{
		const std::vector<FCheckpointDefinition> Gates = MakeThreeGateTrack();
		FRaceProgress State = CreateRaceProgress(2);

		SubmitCheckpoint(State, Gates, 1, FVec2{ 0.0, 0.0 });
		SubmitCheckpoint(State, Gates, 2, FVec2{ 100.0, 0.0 });
		State.RaceTimeSeconds = 60.0;
		FCheckpointOutcome LapOne = SubmitCheckpoint(State, Gates, 3, FVec2{ 100.0, 100.0 });
		CHECK(LapOne.Verdict == ECheckpointVerdict::AcceptedLapCompleted);
		CHECK(!State.bFinished);
		CHECK(State.Lap == 2);
		CHECK(State.NextCheckpointIndex == 0);

		// Crossing the finish again without the lap's checkpoints is rejected.
		FCheckpointOutcome Cheat = SubmitCheckpoint(State, Gates, 3, FVec2{ 100.0, 100.0 });
		CHECK(Cheat.Verdict == ECheckpointVerdict::RejectedWrongOrder);

		SubmitCheckpoint(State, Gates, 1, FVec2{ 0.0, 0.0 });
		SubmitCheckpoint(State, Gates, 2, FVec2{ 100.0, 0.0 });
		State.RaceTimeSeconds = 105.0;
		FCheckpointOutcome LapTwo = SubmitCheckpoint(State, Gates, 3, FVec2{ 100.0, 100.0 });
		CHECK(LapTwo.Verdict == ECheckpointVerdict::AcceptedRaceFinished);
		CHECK_NEAR(LapTwo.LapTimeSeconds, 45.0, 1e-9);
		CHECK_NEAR(State.BestLapSeconds, 45.0, 1e-9);
		CHECK(State.LapsCompleted == 2);
		CHECK(State.LapTimes.size() == 2);
	}

	TEST(LapTimePlausibility)
	{
		CHECK(!IsPlausibleLapTime(0.0, 3000.0, 60.0));
		CHECK(!IsPlausibleLapTime(-4.0, 3000.0, 60.0));
		CHECK(!IsPlausibleLapTime(20.0, 3000.0, 60.0));
		CHECK(IsPlausibleLapTime(60.0, 3000.0, 60.0));
		CHECK(IsPlausibleLapTime(180.0, 3000.0, 60.0));
		CHECK(!IsPlausibleLapTime(5000.0, 3000.0, 60.0));
		CHECK(!IsPlausibleLapTime(60.0, 0.0, 60.0));
		CHECK(!IsPlausibleLapTime(60.0, 3000.0, 0.0));
	}

	TEST(RacePositionOrdering)
	{
		std::vector<FStandingInput> Racers = {
			FStandingInput{ 1, 2, 3, true, 120.0, 0.0 },
			FStandingInput{ 2, 2, 3, true, 118.0, 0.0 },
			FStandingInput{ 3, 2, 3, false, 0.0, 42.0 },
			FStandingInput{ 4, 1, 1, false, 0.0, 8.0 },
			FStandingInput{ 5, 2, 3, false, 0.0, 11.0 },
		};

		const std::vector<int> Order = ComputeRacePositions(Racers);
		CHECK(Order.size() == 5);
		CHECK(Order[0] == 2);
		CHECK(Order[1] == 1);
		CHECK(Order[2] == 5);
		CHECK(Order[3] == 3);
		CHECK(Order[4] == 4);
		CHECK(FindRacePosition(Order, 4) == 5);
		CHECK(FindRacePosition(Order, 42) == 0);
	}

	TEST(GhostSamplingAndSanitising)
	{
		std::vector<FGhostSample> Raw = {
			FGhostSample{ 1.0, FVec2{ 10.0, 0.0 }, -1.5 },
			FGhostSample{ 0.0, FVec2{ 0.0, 0.0 }, 1.5 },
			FGhostSample{ 1.0, FVec2{ 999.0, 999.0 }, 0.0 },   // duplicate timestamp
			FGhostSample{ 0.5, FVec2{ 0.0 / 0.0, 0.0 }, 0.0 }, // non-finite
		};

		const std::vector<FGhostSample> Clean = SanitizeGhostSamples(Raw);
		CHECK(Clean.size() == 2);
		CHECK_NEAR(Clean[0].TimeSeconds, 0.0, 1e-9);
		CHECK_NEAR(Clean[1].TimeSeconds, 1.0, 1e-9);

		FVec2 Position;
		double Yaw = 0.0;
		CHECK(SampleGhostPose(Clean, 0.5, Position, Yaw));
		CHECK_NEAR(Position.X, 5.0, 1e-9);
		CHECK_NEAR(Position.Y, 0.0, 1e-9);
		CHECK_NEAR(Yaw, 0.0, 1e-6); // shortest arc across the +/-Pi wrap

		CHECK(SampleGhostPose(Clean, -10.0, Position, Yaw));
		CHECK_NEAR(Position.X, 0.0, 1e-9);
		CHECK(SampleGhostPose(Clean, 10.0, Position, Yaw));
		CHECK_NEAR(Position.X, 10.0, 1e-9);
		CHECK(!SampleGhostPose({}, 1.0, Position, Yaw));
	}

	TEST(LeaderboardOrderingAndValidation)
	{
		std::vector<FLapRecord> Board;
		Board = InsertLeaderboardRecord(Board, FLapRecord{ "wanjiku", "safari-rally-gt", 71.2, 201.0, 120.0, "2026-01-01T10:00:00Z" }, 3);
		Board = InsertLeaderboardRecord(Board, FLapRecord{ "omondi", "nganya-111-turbo", 64.9, 188.0, 80.0, "2026-01-01T10:01:00Z" }, 3);
		Board = InsertLeaderboardRecord(Board, FLapRecord{ "kamau", "savannah-v8", 68.4, 210.0, 300.0, "2026-01-01T10:02:00Z" }, 3);
		Board = InsertLeaderboardRecord(Board, FLapRecord{ "achieng", "safari-rally-gt", 90.0, 175.0, 10.0, "2026-01-01T10:03:00Z" }, 3);

		CHECK(Board.size() == 3);
		CHECK(Board[0].PlayerId == "omondi");
		CHECK(Board[1].PlayerId == "kamau");
		CHECK(Board[2].PlayerId == "wanjiku");

		CHECK(!IsValidLapRecord(FLapRecord{ "", "car", 60.0, 100.0, 0.0, "t" }));
		CHECK(!IsValidLapRecord(FLapRecord{ "x", "", 60.0, 100.0, 0.0, "t" }));
		CHECK(!IsValidLapRecord(FLapRecord{ "x", "car", -1.0, 100.0, 0.0, "t" }));
		CHECK(!IsValidLapRecord(FLapRecord{ "x", "car", 60.0, 100000.0, 0.0, "t" }));

		const std::vector<FLapRecord> Unchanged = InsertLeaderboardRecord(Board, FLapRecord{}, 3);
		CHECK(Unchanged.size() == 3);
	}

	TEST(LeftHandLaneGeometry)
	{
		// Kenyatta Avenue in the prototype is 24 m wide. Unreal +X is north, +Y is east.
		// Direction +1 = north (NS street) / east (EW street).
		CHECK_NEAR(ComputeLeftHandLaneOffset(true, 1, 24.0, 0), -5.76, 1e-9);
		CHECK_NEAR(ComputeLeftHandLaneOffset(true, -1, 24.0, 0), 5.76, 1e-9);
		CHECK_NEAR(ComputeLeftHandLaneOffset(false, 1, 24.0, 0), 5.76, 1e-9);
		CHECK_NEAR(ComputeLeftHandLaneOffset(false, -1, 24.0, 0), -5.76, 1e-9);
		CHECK_NEAR(ComputeLeftHandLaneOffset(false, 1, 24.0, 1), 5.76 + 2.5, 1e-9);

		CHECK_NEAR(ComputeStreetHeadingYawRadians(true, 1), 0.0, 1e-9);
		CHECK_NEAR(ComputeStreetHeadingYawRadians(true, -1), Pi, 1e-9);
		CHECK_NEAR(ComputeStreetHeadingYawRadians(false, 1), Pi / 2.0, 1e-9);
		CHECK_NEAR(ComputeStreetHeadingYawRadians(false, -1), -Pi / 2.0, 1e-9);

		// A vehicle in the left-hand lane must sit left of the centreline when facing forward.
		const double NorthboundOffset = ComputeLeftHandLaneOffset(true, 1, 24.0, 0);
		CHECK(NorthboundOffset < 0.0); // -Y is to the left when facing +X
	}

	TEST(TrafficSignalPhases)
	{
		CHECK(EvaluateSignalState(0.0) == ESignalState::NorthSouthGreen);
		CHECK(EvaluateSignalState(5.9) == ESignalState::NorthSouthGreen);
		CHECK(EvaluateSignalState(6.5) == ESignalState::NorthSouthAmber);
		CHECK(EvaluateSignalState(9.0) == ESignalState::EastWestGreen);
		CHECK(EvaluateSignalState(15.0) == ESignalState::EastWestAmber);
		CHECK(EvaluateSignalState(16.5) == ESignalState::NorthSouthGreen);

		CHECK(!ShouldVehicleStopForSignal(ESignalState::NorthSouthGreen, true));
		CHECK(ShouldVehicleStopForSignal(ESignalState::EastWestGreen, true));
		CHECK(!ShouldVehicleStopForSignal(ESignalState::EastWestGreen, false));
		CHECK(ShouldVehicleStopForSignal(ESignalState::EastWestAmber, false));
	}

	TEST(NitrousStateMachine)
	{
		FNitroState Nitro;
		CHECK(Nitro.Phase == ENitroPhase::Ready);
		CHECK_NEAR(Nitro.Capacity01, 1.0, 1e-9);
		CHECK(!IsNitroThrusting(Nitro));

		StepNitro(Nitro, true, 0.1);
		CHECK(Nitro.Phase == ENitroPhase::Active);
		CHECK(IsNitroThrusting(Nitro));

		for (int Step = 0; Step < 34; ++Step)
		{
			StepNitro(Nitro, true, 0.1);
		}
		CHECK(Nitro.Phase == ENitroPhase::Active);
		StepNitro(Nitro, true, 0.1);
		CHECK(Nitro.Phase == ENitroPhase::Cooldown);
		CHECK(!IsNitroThrusting(Nitro));
		CHECK_NEAR(Nitro.Capacity01, 0.0, 1e-6);

		for (int Step = 0; Step < 60; ++Step)
		{
			StepNitro(Nitro, true, 0.1); // holding the button must not re-trigger early
		}
		CHECK(Nitro.Phase == ENitroPhase::Ready);
		CHECK_NEAR(Nitro.Capacity01, 1.0, 1e-6);
	}

	TEST(LegacyCoordinateConversion)
	{
		// Prototype spawn: x = -168, z = -50.5, heading = +Pi/2 (east along Kenyatta Ave).
		CHECK_NEAR(LegacyCoordinates::ToUnrealX(-50.5), 5050.0, 1e-9);
		CHECK_NEAR(LegacyCoordinates::ToUnrealY(-168.0), -16800.0, 1e-9);
		CHECK_NEAR(LegacyCoordinates::ToUnrealZ(0.0), 0.0, 1e-9);
		CHECK_NEAR(LegacyCoordinates::ToUnrealYawRadians(Pi / 2.0), Pi / 2.0, 1e-9);

		// North is -Z in the prototype and +X in Unreal.
		CHECK(LegacyCoordinates::ToUnrealX(-100.0) > LegacyCoordinates::ToUnrealX(0.0));
	}
}

int main()
{
	std::printf("NairobiRacing::Core harness\n");
	std::printf("checks: %d, failures: %d\n", GChecks, GFailures);
	if (GFailures == 0)
	{
		std::printf("RESULT: PASS\n");
		return 0;
	}
	std::printf("RESULT: FAIL\n");
	return 1;
}
