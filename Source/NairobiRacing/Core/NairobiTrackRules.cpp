#include "Core/NairobiTrackRules.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace NairobiRacing::Core
{
	namespace
	{
		constexpr double Pi = 3.14159265358979323846;
		constexpr double TwoPi = Pi * 2.0;

		bool IsFinite(double Value)
		{
			return std::isfinite(Value) != 0;
		}

		/** Progress score used to rank racers that have not finished yet. */
		long long ProgressScore(const FStandingInput& Racer, int CheckpointCount)
		{
			const int Laps = std::max(0, Racer.Lap - 1);
			const int Gates = std::max(0, Racer.CompletedCheckpoints);
			return static_cast<long long>(Laps) * (static_cast<long long>(CheckpointCount) + 1LL) + Gates;
		}
	}

	double Distance2D(const FVec2& A, const FVec2& B)
	{
		const double DX = A.X - B.X;
		const double DY = A.Y - B.Y;
		return std::sqrt(DX * DX + DY * DY);
	}

	double NormalizeAngleRadians(double Radians)
	{
		if (!IsFinite(Radians))
		{
			return 0.0;
		}
		double Wrapped = std::fmod(Radians + Pi, TwoPi);
		if (Wrapped < 0.0)
		{
			Wrapped += TwoPi;
		}
		return Wrapped - Pi;
	}

	const char* ToString(ECheckpointVerdict Verdict)
	{
		switch (Verdict)
		{
		case ECheckpointVerdict::AcceptedCheckpoint: return "AcceptedCheckpoint";
		case ECheckpointVerdict::AcceptedLapCompleted: return "AcceptedLapCompleted";
		case ECheckpointVerdict::AcceptedRaceFinished: return "AcceptedRaceFinished";
		case ECheckpointVerdict::RejectedRaceInactive: return "RejectedRaceInactive";
		case ECheckpointVerdict::RejectedUnknownGate: return "RejectedUnknownGate";
		case ECheckpointVerdict::RejectedWrongOrder: return "RejectedWrongOrder";
		case ECheckpointVerdict::RejectedOutOfRange: return "RejectedOutOfRange";
		}
		return "Unknown";
	}

	FRaceProgress CreateRaceProgress(int TotalLaps)
	{
		FRaceProgress Progress;
		Progress.TotalLaps = std::max(1, TotalLaps);
		Progress.NextCheckpointIndex = 0;
		Progress.Lap = 1;
		Progress.LapsCompleted = 0;
		Progress.bFinished = false;
		Progress.RaceTimeSeconds = 0.0;
		Progress.LapStartTimeSeconds = 0.0;
		Progress.BestLapSeconds = 0.0;
		return Progress;
	}

	FCheckpointOutcome SubmitCheckpoint(
		FRaceProgress& State,
		const std::vector<FCheckpointDefinition>& Gates,
		int GateId,
		const FVec2& VehiclePositionMeters)
	{
		FCheckpointOutcome Outcome;
		Outcome.Lap = State.Lap;

		if (State.bFinished || Gates.empty())
		{
			Outcome.Verdict = ECheckpointVerdict::RejectedRaceInactive;
			return Outcome;
		}

		int GateIndex = -1;
		for (int Index = 0; Index < static_cast<int>(Gates.size()); ++Index)
		{
			if (Gates[static_cast<std::size_t>(Index)].Id == GateId)
			{
				GateIndex = Index;
				break;
			}
		}

		if (GateIndex < 0)
		{
			Outcome.Verdict = ECheckpointVerdict::RejectedUnknownGate;
			return Outcome;
		}

		// Strict ordering: duplicates and skipped gates are both rejected.
		if (GateIndex != State.NextCheckpointIndex)
		{
			Outcome.Verdict = ECheckpointVerdict::RejectedWrongOrder;
			return Outcome;
		}

		const FCheckpointDefinition& Gate = Gates[static_cast<std::size_t>(GateIndex)];
		const double Distance = Distance2D(VehiclePositionMeters, Gate.Center);
		const double AllowedRadius = std::max(1.0, Gate.RadiusMeters);
		if (!IsFinite(Distance) || Distance > AllowedRadius)
		{
			Outcome.Verdict = ECheckpointVerdict::RejectedOutOfRange;
			return Outcome;
		}

		Outcome.bAccepted = true;

		const bool bLastGate = (State.NextCheckpointIndex == static_cast<int>(Gates.size()) - 1);

		if (!(bLastGate && Gate.bIsFinishLine))
		{
			++State.NextCheckpointIndex;
			Outcome.Verdict = ECheckpointVerdict::AcceptedCheckpoint;
			return Outcome;
		}

		// Finish line crossed with every checkpoint of this lap already cleared.
		const double LapTime = State.RaceTimeSeconds - State.LapStartTimeSeconds;
		Outcome.LapTimeSeconds = std::max(0.0, LapTime);
		State.LapTimes.push_back(Outcome.LapTimeSeconds);
		if (State.BestLapSeconds <= 0.0 || (Outcome.LapTimeSeconds > 0.0 && Outcome.LapTimeSeconds < State.BestLapSeconds))
		{
			State.BestLapSeconds = Outcome.LapTimeSeconds;
		}

		++State.LapsCompleted;
		State.LapStartTimeSeconds = State.RaceTimeSeconds;
		State.NextCheckpointIndex = 0;

		if (State.LapsCompleted >= State.TotalLaps)
		{
			State.bFinished = true;
			Outcome.bRaceFinished = true;
			Outcome.Lap = State.TotalLaps;
			Outcome.Verdict = ECheckpointVerdict::AcceptedRaceFinished;
			return Outcome;
		}

		++State.Lap;
		Outcome.Lap = State.Lap;
		Outcome.bRaceFinished = false;
		Outcome.Verdict = ECheckpointVerdict::AcceptedLapCompleted;
		return Outcome;
	}

	bool IsPlausibleLapTime(
		double LapTimeSeconds,
		double TrackLengthMeters,
		double VehicleMaxSpeedMps)
	{
		if (!IsFinite(LapTimeSeconds) || LapTimeSeconds <= 0.0)
		{
			return false;
		}
		if (!IsFinite(TrackLengthMeters) || TrackLengthMeters <= 0.0)
		{
			return false;
		}
		if (!IsFinite(VehicleMaxSpeedMps) || VehicleMaxSpeedMps <= 0.0)
		{
			return false;
		}

		// A lap cannot be completed faster than the track length at 150% of the
		// vehicle's configured top speed (nitrous/slipstream headroom).
		const double PhysicalFloor = TrackLengthMeters / (VehicleMaxSpeedMps * 1.5);
		constexpr double SanityCeiling = 30.0 * 60.0;
		return LapTimeSeconds >= PhysicalFloor && LapTimeSeconds <= SanityCeiling;
	}

	std::vector<int> ComputeRacePositions(const std::vector<FStandingInput>& Racers)
	{
		std::vector<FStandingInput> Sorted = Racers;
		const int CheckpointCount = [&Sorted]()
		{
			int Max = 0;
			for (const FStandingInput& Racer : Sorted)
			{
				Max = std::max(Max, Racer.CompletedCheckpoints);
			}
			return Max;
		}();

		std::sort(Sorted.begin(), Sorted.end(), [CheckpointCount](const FStandingInput& A, const FStandingInput& B)
		{
			if (A.bFinished != B.bFinished)
			{
				return A.bFinished;
			}
			if (A.bFinished && B.bFinished && A.FinishTimeSeconds != B.FinishTimeSeconds)
			{
				return A.FinishTimeSeconds < B.FinishTimeSeconds;
			}

			const long long ScoreA = ProgressScore(A, CheckpointCount);
			const long long ScoreB = ProgressScore(B, CheckpointCount);
			if (ScoreA != ScoreB)
			{
				return ScoreA > ScoreB;
			}
			if (A.DistanceToNextGateMeters != B.DistanceToNextGateMeters)
			{
				return A.DistanceToNextGateMeters < B.DistanceToNextGateMeters;
			}
			return A.Id < B.Id; // deterministic tie-break
		});

		std::vector<int> OrderedIds;
		OrderedIds.reserve(Sorted.size());
		for (const FStandingInput& Racer : Sorted)
		{
			OrderedIds.push_back(Racer.Id);
		}
		return OrderedIds;
	}

	int FindRacePosition(const std::vector<int>& OrderedIds, int Id)
	{
		for (std::size_t Index = 0; Index < OrderedIds.size(); ++Index)
		{
			if (OrderedIds[Index] == Id)
			{
				return static_cast<int>(Index) + 1;
			}
		}
		return 0;
	}

	std::vector<FGhostSample> SanitizeGhostSamples(
		const std::vector<FGhostSample>& Samples,
		std::size_t MaxSamples)
	{
		// Order first: recordings arrive from disk/network in arbitrary order and may
		// contain duplicates. Sorting before the monotonic filter keeps the earliest
		// sample of each timestamp, matching how ghosts are replayed.
		std::vector<FGhostSample> Ordered;
		Ordered.reserve(Samples.size());

		for (const FGhostSample& Sample : Samples)
		{
			if (!IsFinite(Sample.TimeSeconds) || !IsFinite(Sample.Position.X) || !IsFinite(Sample.Position.Y) || !IsFinite(Sample.YawRadians))
			{
				continue;
			}
			if (Sample.TimeSeconds < 0.0)
			{
				continue;
			}
			Ordered.push_back(FGhostSample{ Sample.TimeSeconds, Sample.Position, NormalizeAngleRadians(Sample.YawRadians) });
		}

		std::stable_sort(Ordered.begin(), Ordered.end(), [](const FGhostSample& A, const FGhostSample& B)
		{
			return A.TimeSeconds < B.TimeSeconds;
		});

		std::vector<FGhostSample> Clean;
		Clean.reserve(std::min(Ordered.size(), MaxSamples));
		for (const FGhostSample& Sample : Ordered)
		{
			if (!Clean.empty() && Sample.TimeSeconds <= Clean.back().TimeSeconds)
			{
				continue;
			}
			Clean.push_back(Sample);
			if (Clean.size() >= MaxSamples)
			{
				break;
			}
		}
		return Clean;
	}

	bool SampleGhostPose(
		const std::vector<FGhostSample>& Samples,
		double TimeSeconds,
		FVec2& OutPosition,
		double& OutYawRadians)
	{
		if (Samples.empty() || !IsFinite(TimeSeconds))
		{
			return false;
		}
		if (TimeSeconds <= Samples.front().TimeSeconds)
		{
			OutPosition = Samples.front().Position;
			OutYawRadians = Samples.front().YawRadians;
			return true;
		}
		if (TimeSeconds >= Samples.back().TimeSeconds)
		{
			OutPosition = Samples.back().Position;
			OutYawRadians = Samples.back().YawRadians;
			return true;
		}

		std::size_t Low = 0;
		std::size_t High = Samples.size() - 1;
		while (High - Low > 1)
		{
			const std::size_t Mid = (Low + High) / 2;
			if (Samples[Mid].TimeSeconds <= TimeSeconds)
			{
				Low = Mid;
			}
			else
			{
				High = Mid;
			}
		}

		const FGhostSample& A = Samples[Low];
		const FGhostSample& B = Samples[High];
		const double Span = B.TimeSeconds - A.TimeSeconds;
		const double Alpha = (Span > 1e-6) ? std::clamp((TimeSeconds - A.TimeSeconds) / Span, 0.0, 1.0) : 0.0;

		OutPosition.X = A.Position.X + (B.Position.X - A.Position.X) * Alpha;
		OutPosition.Y = A.Position.Y + (B.Position.Y - A.Position.Y) * Alpha;
		OutYawRadians = NormalizeAngleRadians(A.YawRadians + NormalizeAngleRadians(B.YawRadians - A.YawRadians) * Alpha);
		return true;
	}

	bool IsValidLapRecord(const FLapRecord& Record, double MaxTopSpeedKph)
	{
		if (Record.PlayerId.empty() || Record.VehicleId.empty())
		{
			return false;
		}
		if (!IsFinite(Record.LapTimeSeconds) || Record.LapTimeSeconds <= 0.0)
		{
			return false;
		}
		if (!IsFinite(Record.TopSpeedKph) || Record.TopSpeedKph < 0.0 || Record.TopSpeedKph > MaxTopSpeedKph)
		{
			return false;
		}
		if (!IsFinite(Record.DriftScore) || Record.DriftScore < 0.0)
		{
			return false;
		}
		return true;
	}

	std::vector<FLapRecord> InsertLeaderboardRecord(
		std::vector<FLapRecord> Records,
		const FLapRecord& Candidate,
		std::size_t MaxEntries)
	{
		if (!IsValidLapRecord(Candidate))
		{
			return Records;
		}

		Records.push_back(Candidate);
		std::stable_sort(Records.begin(), Records.end(), [](const FLapRecord& A, const FLapRecord& B)
		{
			if (A.LapTimeSeconds != B.LapTimeSeconds)
			{
				return A.LapTimeSeconds < B.LapTimeSeconds;
			}
			if (A.DriftScore != B.DriftScore)
			{
				return A.DriftScore > B.DriftScore;
			}
			return A.RecordedAtIso < B.RecordedAtIso;
		});

		if (Records.size() > MaxEntries)
		{
			Records.resize(MaxEntries);
		}
		return Records;
	}

	double ComputeLeftHandLaneOffset(
		bool bNorthSouthStreet,
		int Direction,
		double StreetWidthMeters,
		int LaneIndex)
	{
		const int SafeDirection = (Direction >= 0) ? 1 : -1;
		const int SafeLane = std::max(0, LaneIndex);
		const double BaseOffset = std::max(3.6, StreetWidthMeters * 0.24) + SafeLane * 2.5;

		// Unreal: +X north, +Y east, +Z up. Facing +X, left is -Y; facing +Y, left is +X.
		// Kenya drives on the left, so:
		//   northbound (+X) sits at -Y of the centreline, southbound at +Y
		//   eastbound (+Y) sits at +X of the centreline, westbound at -X
		// Direction +1 means north on a north-south street and east on an east-west street.
		if (bNorthSouthStreet)
		{
			return (SafeDirection > 0) ? -BaseOffset : BaseOffset;
		}
		return (SafeDirection > 0) ? BaseOffset : -BaseOffset;
	}

	double ComputeStreetHeadingYawRadians(bool bNorthSouthStreet, int Direction)
	{
		const int SafeDirection = (Direction >= 0) ? 1 : -1;
		if (bNorthSouthStreet)
		{
			// North = +X => yaw 0, South = -X => Pi.
			return (SafeDirection > 0) ? 0.0 : Pi;
		}
		// East = +Y => +Pi/2, West = -Y => -Pi/2.
		return (SafeDirection > 0) ? Pi / 2.0 : -Pi / 2.0;
	}

	ESignalState EvaluateSignalState(double CyclePositionSeconds)
	{
		constexpr double CycleSeconds = 16.0;
		double T = std::fmod(CyclePositionSeconds, CycleSeconds);
		if (T < 0.0)
		{
			T += CycleSeconds;
		}
		if (T < 6.0) return ESignalState::NorthSouthGreen;
		if (T < 8.0) return ESignalState::NorthSouthAmber;
		if (T < 14.0) return ESignalState::EastWestGreen;
		return ESignalState::EastWestAmber;
	}

	bool ShouldVehicleStopForSignal(ESignalState State, bool bTravellingNorthSouth)
	{
		if (bTravellingNorthSouth)
		{
			return State != ESignalState::NorthSouthGreen;
		}
		return State != ESignalState::EastWestGreen;
	}

	void StepNitro(FNitroState& State, bool bBoostRequested, double DeltaSeconds)
	{
		const double Dt = std::clamp(IsFinite(DeltaSeconds) ? DeltaSeconds : 0.0, 0.0, 0.1);
		// Fixed-step timers accumulate float residue; treat sub-microsecond remainders
		// as elapsed so phases always advance on the frame the timer expires.
		constexpr double TimeEpsilon = 1e-6;

		switch (State.Phase)
		{
		case ENitroPhase::Ready:
			State.Capacity01 = 1.0;
			if (bBoostRequested)
			{
				State.Phase = ENitroPhase::Active;
				State.TimerSeconds = NitroActiveSeconds;
				State.Capacity01 = 1.0;
			}
			break;

		case ENitroPhase::Active:
			State.TimerSeconds = std::max(0.0, State.TimerSeconds - Dt);
			State.Capacity01 = std::clamp(State.TimerSeconds / NitroActiveSeconds, 0.0, 1.0);
			if (State.TimerSeconds <= TimeEpsilon)
			{
				State.Phase = ENitroPhase::Cooldown;
				State.TimerSeconds = NitroCooldownSeconds;
				State.Capacity01 = 0.0;
			}
			break;

		case ENitroPhase::Cooldown:
			State.TimerSeconds = std::max(0.0, State.TimerSeconds - Dt);
			State.Capacity01 = std::clamp(1.0 - (State.TimerSeconds / NitroCooldownSeconds), 0.0, 1.0);
			if (State.TimerSeconds <= TimeEpsilon)
			{
				State.Phase = ENitroPhase::Ready;
				State.TimerSeconds = 0.0;
				State.Capacity01 = 1.0;
			}
			break;
		}
	}

	bool IsNitroThrusting(const FNitroState& State)
	{
		return State.Phase == ENitroPhase::Active;
	}
}
