#include "VehiclePhysics/NairobiVehicleRecoveryComponent.h"

#include "GameFramework/Actor.h"

UNairobiVehicleRecoveryComponent::UNairobiVehicleRecoveryComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UNairobiVehicleRecoveryComponent::ReportDriverIntent(float Throttle, float SpeedKph)
{
	LastThrottle = FMath::Clamp(Throttle, 0.f, 1.f);

	const bool bUpsideDown = GetOwner() && (GetOwner()->GetActorUpVector().Z < 0.25f);
	const bool bHeldUpWithThrottle = LastThrottle > 0.4f && SpeedKph < StrandedSpeedThresholdKph;

	if (bUpsideDown)
	{
		StationarySeconds = StrandedAfterSeconds; // flipped: immediate recovery offer
	}
	else if (bHeldUpWithThrottle)
	{
		StationarySeconds += GetWorld() ? GetWorld()->GetDeltaSeconds() : 0.f;
	}
	else
	{
		StationarySeconds = 0.f;
	}

	const bool bShouldBeStranded = StationarySeconds >= StrandedAfterSeconds;
	if (bShouldBeStranded != bStranded)
	{
		bStranded = bShouldBeStranded;
		OnStrandedChanged.Broadcast(bStranded);
	}
}

void UNairobiVehicleRecoveryComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	RecoveryCooldownRemaining = FMath::Max(0.f, RecoveryCooldownRemaining - DeltaTime);
}

void UNairobiVehicleRecoveryComponent::BeginPlay()
{
	Super::BeginPlay();
	RecoveryCooldownRemaining = 0.f;
}
