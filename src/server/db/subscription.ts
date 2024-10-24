import { subscriptionTiers } from "@/data/subscriptionTiers"
import { db } from "@/drizzle/db"
import { UserSubscriptionTable } from "@/drizzle/schema"
import { CACHE_TAGS, dbCache, getUserTag, revalidateDbCache } from "@/lib/cache"
import { SQL } from "drizzle-orm"

export async function createUserSubscription(
  data: typeof UserSubscriptionTable.$inferInsert
) {
  try {
    const [newSubscription] = await db
      .insert(UserSubscriptionTable)
      .values(data)
      .onConflictDoNothing({
        target: UserSubscriptionTable.clerkUserId,
      })
      .returning({
        id: UserSubscriptionTable.id,
        userId: UserSubscriptionTable.clerkUserId,
      })

    if (newSubscription != null) {
      revalidateDbCache({
        tag: CACHE_TAGS.subscription,
        id: newSubscription.id,
        userId: newSubscription.userId,
      })
    }

    return newSubscription
  } catch (error) {
    console.error("Error creating user subscription:", error)
    throw new Error("Failed to create user subscription")
  }
}

export function getUserSubscription(userId: string) {
  const cacheFn = dbCache(getUserSubscriptionInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.subscription)],
  })

  return cacheFn(userId)
}

export async function updateUserSubscription(
  where: SQL,
  data: Partial<typeof UserSubscriptionTable.$inferInsert>
) {
  try {
    const [updatedSubscription] = await db
      .update(UserSubscriptionTable)
      .set(data)
      .where(where)
      .returning({
        id: UserSubscriptionTable.id,
        userId: UserSubscriptionTable.clerkUserId,
      })

    if (updatedSubscription != null) {
      revalidateDbCache({
        tag: CACHE_TAGS.subscription,
        userId: updatedSubscription.userId,
        id: updatedSubscription.id,
      })
    }
  } catch (error) {
    console.error("Error updating user subscription:", error)
    throw new Error("Failed to update user subscription")
  }
}

export async function getUserSubscriptionTier(userId: string) {
  const subscription = await getUserSubscription(userId)

  // Handle the case where the user has no subscription
  if (subscription == null) {
    return { canAccessAnalytics: false } // Default value or handle as needed
  }

  return subscriptionTiers[subscription.tier]
}

function getUserSubscriptionInternal(userId: string) {
  return db.query.UserSubscriptionTable.findFirst({
    where: ({ clerkUserId }, { eq }) => eq(clerkUserId, userId),
  })
}
