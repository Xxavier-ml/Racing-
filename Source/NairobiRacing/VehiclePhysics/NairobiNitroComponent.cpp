#include "VehiclePhysics/NairobiNitroComponent.h"

#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/Actor.h"

UNairobiNitroComponent::UNairobiNitroComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PrePhysics;
	SetIsReplicatedByDefault(true);
}

void UNairobiNitroComponent::SetBoostRequested(bool bRequested)
{
	bBoostRequested = bRequested;
}

void UNairobiNitroComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	NairobiRacing::Core::StepNitro(NitroState, bBoostRequested, DeltaTime);

	const int32 Phase = static_cast<int32>(NitroState.Phase);
	if (Phase != LastBroadcastPhase)
	{
		LastBroadcastPhase = Phase;
		OnNitroStateChanged.Broadcast(Phase, static_cast<float>(NitroState.Capacity01));
	}

	if (!NairobiRacing::Core::IsNitroThrusting(NitroState) || !bApplyThrustLocally)
	{
		return;
	}

	AActor* Owner = GetOwner();
	if (Owner == nullptr)
	{
		return;
	}

	// Thrust is applied along the chassis forward vector at the centre of mass so it
	// adds straight-line acceleration without a spurious yaw moment.
	if (USkeletalMeshComponent* Chassis = Owner->FindComponentByClass<USkeletalMeshComponent>())
	{
		const FVector Forward = Owner->GetActorForwardVector();
		Chassis->AddForce(Forward * ThrustForceNewtons, NAME_None, false);
	}
}
