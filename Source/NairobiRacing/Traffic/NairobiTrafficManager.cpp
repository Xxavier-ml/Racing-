#include "Traffic/NairobiTrafficManager.h"

#include "Traffic/NairobiTrafficVehicle.h"
#include "Core/NairobiTrackRules.h"
#include "World/NairobiRaceTrackData.h"
#include "NairobiRacing.h"

#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"

namespace
{
	const TArray<ENairobiVehicleClass> GArchetypeRotation = {
		ENairobiVehicleClass::TrafficMatatu,
		ENairobiVehicleClass::TrafficSaloon,
		ENairobiVehicleClass::TrafficBodaBoda,
		ENairobiVehicleClass::TrafficMatatu,
		ENairobiVehicleClass::TrafficBus,
		ENairobiVehicleClass::TrafficSafari,
		ENairobiVehicleClass::TrafficBodaBoda,
		ENairobiVehicleClass::TrafficSaloon
	};
}

ANairobiTrafficManager::ANairobiTrafficManager()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.05f; // 20 Hz lane updates are plenty for traffic
	bReplicates = false;
	TrafficVehicleClass = ANairobiTrafficVehicle::StaticClass();
}

void ANairobiTrafficManager::BeginPlay()
{
	Super::BeginPlay();
}

void ANairobiTrafficManager::BuildTrafficFleet(const UNairobiRaceTrackData* TrackData)
{
	if (!TrackData || !bTrafficEnabled || !GetWorld())
	{
		return;
	}

	Agents.Reset();
	CrossingCoordinates.Reset();

	// Record crossing coordinates first so signal stop lines exist for every street.
	for (const FNairobiStreetRow& Street : TrackData->Streets)
	{
		CrossingCoordinates.Add(static_cast<float>(Street.FixAxisCm));
	}

	for (const FNairobiStreetRow& Street : TrackData->Streets)
	{
		const FString StreetName = Street.DisplayName.IsEmpty() ? TEXT("Street") : Street.DisplayName;
		SpawnLaneAgentsForStreet(
			StreetName,
			Street.bNorthSouth,
			static_cast<float>(Street.FixAxisCm),
			static_cast<float>(Street.StartAlongCm),
			static_cast<float>(Street.EndAlongCm),
			static_cast<float>(Street.WidthCm),
			VehiclesPerStreet);
	}

	UE_LOG(LogNairobiTraffic, Log, TEXT("Traffic fleet built: %d vehicle(s) across %d street(s)."), Agents.Num(), TrackData->Streets.Num());
}

void ANairobiTrafficManager::SpawnLaneAgentsForStreet(
	const FString& StreetName,
	bool bNorthSouth,
	float FixAxisCm,
	float StartAlongCm,
	float EndAlongCm,
	float WidthCm,
	int32 VehicleCount)
{
	if (VehicleCount <= 0)
	{
		return;
	}

	const float MinAlong = FMath::Min(StartAlongCm, EndAlongCm) + 600.f;
	const float MaxAlong = FMath::Max(StartAlongCm, EndAlongCm) - 600.f;
	if (MaxAlong - MinAlong < 3000.f)
	{
		return;
	}

	for (int32 DirectionIndex = 0; DirectionIndex < 2; ++DirectionIndex)
	{
		const int32 Direction = (DirectionIndex == 0) ? 1 : -1;
		const float LaneOffset = static_cast<float>(NairobiRacing::Core::ComputeLeftHandLaneOffset(
			bNorthSouth,
			Direction,
			WidthCm / 100.0,
			0)) * 100.f;

		const float Spacing = (MaxAlong - MinAlong) / static_cast<float>(VehicleCount);

		for (int32 Slot = 0; Slot < VehicleCount; ++Slot)
		{
			FActorSpawnParameters SpawnParams;
			SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
			SpawnParams.Owner = this;

			FNairobiTrafficLaneAgent Agent;
			Agent.bNorthSouth = bNorthSouth;
			Agent.Direction = Direction;
			Agent.FixAxisCm = FixAxisCm;
			Agent.LaneOffsetCm = LaneOffset;
			Agent.MinAlongCm = MinAlong;
			Agent.MaxAlongCm = MaxAlong;
			Agent.AlongCm = MinAlong + Spacing * (static_cast<float>(Slot) + 0.35f);
			Agent.StreetName = StreetName;

			const ENairobiVehicleClass Archetype = GArchetypeRotation[NextArchetypeIndex % GArchetypeRotation.Num()];
			++NextArchetypeIndex;

			const FVector SpawnLocation = ComputeAgentLocation(Agent) + FVector(0.f, 0.f, 90.f);
			const float Yaw = static_cast<float>(NairobiRacing::Core::ComputeStreetHeadingYawRadians(bNorthSouth, Direction));

			ANairobiTrafficVehicle* Vehicle = GetWorld()->SpawnActor<ANairobiTrafficVehicle>(
				TrafficVehicleClass ? TrafficVehicleClass : ANairobiTrafficVehicle::StaticClass(),
				SpawnLocation,
				FRotator(0.f, FMath::RadiansToDegrees(Yaw), 0.f),
				SpawnParams);

			if (Vehicle == nullptr)
			{
				continue;
			}

			Vehicle->ActivateArchetype(Archetype);
			Agent.Vehicle = Vehicle;
			Agent.CurrentSpeedMps = Vehicle->GetBaseSpeedMps() * 0.7f;
			Agent.VehicleLengthCm = Archetype == ENairobiVehicleClass::TrafficBus ? 840.f : 520.f;
			Agents.Add(MoveTemp(Agent));
		}
	}
}

FVector ANairobiTrafficManager::ComputeAgentLocation(const FNairobiTrafficLaneAgent& Agent) const
{
	const float Perpendicular = Agent.FixAxisCm + Agent.LaneOffsetCm;
	return Agent.bNorthSouth
		? FVector(Agent.AlongCm, Perpendicular, 0.f)
		: FVector(Perpendicular, Agent.AlongCm, 0.f);
}

bool ANairobiTrafficManager::IsSignalStopRequired(bool bNorthSouth, float AlongCm, int32 Direction) const
{
	const NairobiRacing::Core::ESignalState State =
		NairobiRacing::Core::EvaluateSignalState(SignalCycleSeconds);

	if (!NairobiRacing::Core::ShouldVehicleStopForSignal(State, bNorthSouth))
	{
		return false;
	}

	// Stop just before the zebra crossing of the next junction.
	for (const float Crossing : CrossingCoordinates)
	{
		const float DistanceAhead = (Crossing - AlongCm) * static_cast<float>(Direction);
		if (DistanceAhead > 1400.f && DistanceAhead < 2800.f)
		{
			return true;
		}
	}
	return false;
}

void ANairobiTrafficManager::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!bTrafficEnabled || Agents.Num() == 0)
	{
		return;
	}

	SignalCycleSeconds = FMath::Fmod(SignalCycleSeconds + DeltaSeconds, 16.f);

	FVector PlayerLocation = FVector::ZeroVector;
	bool bHasPlayer = false;
	if (const UWorld* World = GetWorld())
	{
		for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
		{
			if (const APlayerController* Controller = It->Get())
			{
				if (const APawn* Pawn = Controller->GetPawn())
				{
					PlayerLocation = Pawn->GetActorLocation();
					bHasPlayer = true;
					break;
				}
			}
		}
	}

	for (FNairobiTrafficLaneAgent& Agent : Agents)
	{
		if (Agent.Vehicle == nullptr)
		{
			continue;
		}

		const bool bShouldSimulate = bHasPlayer
			&& FVector::DistSquared2D(Agent.Vehicle->GetActorLocation(), PlayerLocation) <= FMath::Square(ActivationRadiusCm);

		Agent.Vehicle->SetSimulationActive(bShouldSimulate);
		if (!bShouldSimulate)
		{
			continue;
		}

		float TargetSpeed = Agent.Vehicle->GetBaseSpeedMps();

		if (IsSignalStopRequired(Agent.bNorthSouth, Agent.AlongCm, Agent.Direction))
		{
			TargetSpeed = 0.f;
		}

		// Safe following distance within the same lane.
		for (const FNairobiTrafficLaneAgent& Other : Agents)
		{
			if (&Other == &Agent || Other.Vehicle == nullptr)
			{
				continue;
			}
			if (Other.bNorthSouth != Agent.bNorthSouth || Other.Direction != Agent.Direction
				|| !FMath::IsNearlyEqual(Other.FixAxisCm, Agent.FixAxisCm, 25.f))
			{
				continue;
			}

			const float Gap = (Other.AlongCm - Agent.AlongCm) * static_cast<float>(Agent.Direction);
			const float SafeGap = (Agent.VehicleLengthCm + Other.VehicleLengthCm) * 0.5f + 700.f;
			if (Gap > 0.f && Gap < SafeGap)
			{
				TargetSpeed = FMath::Min(TargetSpeed, Other.CurrentSpeedMps * 0.78f);
			}
		}

		Agent.CurrentSpeedMps = FMath::FInterpTo(Agent.CurrentSpeedMps, TargetSpeed, DeltaSeconds, 2.2f);
		Agent.AlongCm += static_cast<float>(Agent.Direction) * Agent.CurrentSpeedMps * 100.f * DeltaSeconds;

		if (Agent.AlongCm > Agent.MaxAlongCm)
		{
			Agent.AlongCm = Agent.MinAlongCm;
		}
		else if (Agent.AlongCm < Agent.MinAlongCm)
		{
			Agent.AlongCm = Agent.MaxAlongCm;
		}

		Agent.Vehicle->SetCurrentSpeedMps(Agent.CurrentSpeedMps);
		const float Yaw = static_cast<float>(NairobiRacing::Core::ComputeStreetHeadingYawRadians(Agent.bNorthSouth, Agent.Direction));
		Agent.Vehicle->AdvanceAlongLane(ComputeAgentLocation(Agent) + FVector(0.f, 0.f, 90.f), Yaw);
	}
}

int32 ANairobiTrafficManager::GetActiveVehicleCount() const
{
	int32 Count = 0;
	for (const FNairobiTrafficLaneAgent& Agent : Agents)
	{
		if (Agent.Vehicle && Agent.CurrentSpeedMps > 0.1f)
		{
			++Count;
		}
	}
	return Count;
}
