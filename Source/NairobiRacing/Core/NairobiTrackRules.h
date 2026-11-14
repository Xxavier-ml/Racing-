#pragma once

/**
 * NairobiRacing::Core - engine-free simulation rules.
 *
 * This header (and its .cpp) intentionally depends only on the C++ standard library.
 * It contains the competitive rules that must be identical on the client, the
 * dedicated server and any offline tooling:
 *
 *   - checkpoint ordering and finish-line validation
 *   - server-side race position calculation
 *   - lap-time plausibility validation
 *   - ghost-lap sampling
 *   - leaderboard ordering and trimming
 *   - Kenyan left-hand lane geometry and traffic-signal phases
 *   - nitrous state machine
 *   - legacy Web (three.js) -> Unreal coordinate conversion
 *
 * Keeping this layer free of UObject/Engine types means it is compiled by
 * Tools/SimHarness with a plain C++20 compiler in CI, so race-rule regressions are
 * caught even on machines without an Unreal install. The Unreal module wraps these
 * functions; it never reimplements them.
 */

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace NairobiRacing::Core
{
	// ---------------------------------------------------------------------
	// Basic 2D math (metres, Unreal XY plane)
	// ---------------------------------------------------------------------

	struct FVec2
	{
		double X = 0.0;
		double Y = 0.0;
	};

	double Distance2D(const FVec2& A, const FVec2& B);
	double NormalizeAngleRadians(double Radians);

	// ---------------------------------------------------------------------
	// Track / checkpoint definitions
	// ---------------------------------------------------------------------

	struct FCheckpointDefinition
	{
		int Id = 0;
		FVec2 Center;
		double RadiusMeters = 12.0;
		bool bIsFinishLine = false;
	};

	enum class ECheckpointVerdict : std::uint8_t
	{
		AcceptedCheckpoint,
		AcceptedLapCompleted,
		AcceptedRaceFinished,
		RejectedRaceInactive,
		RejectedUnknownGate,
		RejectedWrongOrder,
		RejectedOutOfRange
	};

	const char* ToString(ECheckpointVerdict Verdict);

	struct FRaceProgress
	{
		int NextCheckpointIndex = 0;
		int Lap = 1;
		int LapsCompleted = 0;
		int TotalLaps = 3;
		bool bFinished = false;
		double RaceTimeSeconds = 0.0;
		double LapStartTimeSeconds = 0.0;
		double BestLapSeconds = 0.0;
		std::vector<double> LapTimes;
	};

	struct FCheckpointOutcome
	{
		ECheckpointVerdict Verdict = ECheckpointVerdict::RejectedRaceInactive;
		bool bAccepted = false;
		double LapTimeSeconds = 0.0;
		int Lap = 1;
		bool bRaceFinished = false;
	};

	FRaceProgress CreateRaceProgress(int TotalLaps);

	/**
	 * Authoritative checkpoint submission.
	 *
	 * Validates, in order: race active, gate known, strict gate ordering and that the
	 * vehicle really is inside the gate radius. A client can therefore not skip part of
	 * the circuit by reporting a gate index, nor finish without clearing every gate in
	 * every lap. Returns the verdict; mutates State only when the gate is accepted.
	 */
	FCheckpointOutcome SubmitCheckpoint(
		FRaceProgress& State,
		const std::vector<FCheckpointDefinition>& Gates,
		int GateId,
		const FVec2& VehiclePositionMeters);

	/** Server-only guard: client-reported time must fit the track's physical envelope. */
	bool IsPlausibleLapTime(
		double LapTimeSeconds,
		double TrackLengthMeters,
		double VehicleMaxSpeedMps);

	// ---------------------------------------------------------------------
	// Race standings
	// ---------------------------------------------------------------------

	struct FStandingInput
	{
		int Id = 0;
		int Lap = 1;
		int CompletedCheckpoints = 0;
		bool bFinished = false;
		double FinishTimeSeconds = 0.0;
		double DistanceToNextGateMeters = 0.0;
	};

	/** Returns racer ids ordered from 1st to last. Deterministic for equal progress. */
	std::vector<int> ComputeRacePositions(const std::vector<FStandingInput>& Racers);

	/** 1-based position of Id within the ordering, or 0 when Id is absent. */
	int FindRacePosition(const std::vector<int>& OrderedIds, int Id);

	// ---------------------------------------------------------------------
	// Ghost laps
	// ---------------------------------------------------------------------

	struct FGhostSample
	{
		double TimeSeconds = 0.0;
		FVec2 Position;
		double YawRadians = 0.0;
	};

	/**
	 * Sorts by time, drops non-finite samples, enforces monotonic timestamps,
	 * normalises yaw and caps the buffer. Used both when recording and when loading
	 * a ghost from disk or from the backend.
	 */
	std::vector<FGhostSample> SanitizeGhostSamples(
		const std::vector<FGhostSample>& Samples,
		std::size_t MaxSamples = 6000);

	/** Interpolates position and shortest-arc yaw at TimeSeconds. */
	bool SampleGhostPose(
		const std::vector<FGhostSample>& Samples,
		double TimeSeconds,
		FVec2& OutPosition,
		double& OutYawRadians);

	// ---------------------------------------------------------------------
	// Leaderboard
	// ---------------------------------------------------------------------

	struct FLapRecord
	{
		std::string PlayerId;
		std::string VehicleId;
		double LapTimeSeconds = 0.0;
		double TopSpeedKph = 0.0;
		double DriftScore = 0.0;
		std::string RecordedAtIso;
	};

	/** Inserts a record, sorts fastest-first and trims to MaxEntries. */
	std::vector<FLapRecord> InsertLeaderboardRecord(
		std::vector<FLapRecord> Records,
		const FLapRecord& Candidate,
		std::size_t MaxEntries = 5);

	/** Rejects empty ids, non-finite or non-positive times and absurd top speeds. */
	bool IsValidLapRecord(const FLapRecord& Record, double MaxTopSpeedKph = 600.0);

	// ---------------------------------------------------------------------
	// Nairobi road geometry (left-hand traffic, as in Kenya)
	// ---------------------------------------------------------------------

	/**
	 * Offset from the street centreline to the centre of the given lane, in metres.
	 * NorthSouth == true means the street runs along Z (Unreal: Y), with Direction +1
	 * towards increasing coordinate and -1 towards decreasing coordinate.
	 */
	double ComputeLeftHandLaneOffset(
		bool bNorthSouthStreet,
		int Direction,
		double StreetWidthMeters,
		int LaneIndex);

	/** Yaw in radians for a vehicle travelling along the street in Direction. */
	double ComputeStreetHeadingYawRadians(bool bNorthSouthStreet, int Direction);

	enum class ESignalState : std::uint8_t
	{
		NorthSouthGreen,
		NorthSouthAmber,
		EastWestGreen,
		EastWestAmber
	};

	ESignalState EvaluateSignalState(double CyclePositionSeconds);
	bool ShouldVehicleStopForSignal(ESignalState State, bool bTravellingNorthSouth);

	// ---------------------------------------------------------------------
	// Nitrous
	// ---------------------------------------------------------------------

	enum class ENitroPhase : std::uint8_t
	{
		Ready,
		Active,
		Cooldown
	};

	constexpr double NitroActiveSeconds = 3.5;
	constexpr double NitroCooldownSeconds = 6.0;

	struct FNitroState
	{
		ENitroPhase Phase = ENitroPhase::Ready;
		double TimerSeconds = 0.0;
		double Capacity01 = 1.0;
	};

	/** Advances the Ready -> Active -> Cooldown -> Ready state machine. */
	void StepNitro(FNitroState& State, bool bBoostRequested, double DeltaSeconds);

	bool IsNitroThrusting(const FNitroState& State);

	// ---------------------------------------------------------------------
	// Legacy Web (three.js) -> Unreal conversion
	// ---------------------------------------------------------------------

	namespace LegacyCoordinates
	{
		// Web prototype: X = east, Z = south, Y = up, metres.
		// Unreal: X = north, Y = east, Z = up, centimetres.
		constexpr double MetersToCentimetres = 100.0;

		inline double ToUnrealX(double LegacyZ) { return -LegacyZ * MetersToCentimetres; }
		inline double ToUnrealY(double LegacyX) { return LegacyX * MetersToCentimetres; }
		inline double ToUnrealZ(double LegacyY) { return LegacyY * MetersToCentimetres; }
		inline double ToUnrealYawRadians(double LegacyHeadingRadians) { return LegacyHeadingRadians; }
	}
}
