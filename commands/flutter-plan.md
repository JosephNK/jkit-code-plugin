---
description: Restate requirements, assess risks, and create step-by-step implementation plan. WAIT for user CONFIRM before touching any code.
---

# Flutter Plan Command

This command invokes the **flutter-planner** agent to create a comprehensive implementation plan before writing any code.

## What This Command Does

1. **Restate Requirements** - Clarify what needs to be built
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases
4. **Wait for Confirmation** - MUST receive user approval before proceeding

## When to Use

Use `/flutter-plan` when:
- Starting a new feature
- Making significant architectural changes
- Working on complex refactoring
- Multiple files/components will be affected
- Requirements are unclear or ambiguous

## How It Works

The planner agent will:

1. **Analyze the request** and restate requirements in clear terms
2. **Break down into phases** with specific, actionable steps
3. **Identify dependencies** between components
4. **Assess risks** and potential blockers
5. **Estimate complexity** (High/Medium/Low)
6. **Present the plan** and WAIT for your explicit confirmation

## Example Usage

```
User: /flutter-plan I need to add push notification support

Agent (flutter-planner):
# Implementation Plan: Push Notification Support

## Requirements Restatement
- Receive push notifications on iOS and Android
- Handle foreground, background, and terminated app states
- Navigate to relevant screen when notification is tapped
- Allow users to toggle notification preferences

## Implementation Phases

### Phase 1: Model & Repository
- Create NotificationPayload model (lib/models/notification_payload.dart)
- Create NotificationRepository for API registration (lib/repositories/notification_repository.dart)
- Define notification-related API endpoints

### Phase 2: Notification Service
- Create NotificationService (lib/services/notification_service.dart)
- Initialize firebase_messaging and flutter_local_notifications
- Handle FCM token registration and refresh
- Configure foreground/background message handlers

### Phase 3: State Management
- Create NotificationBloc (lib/blocs/notification/)
- Handle events: PermissionRequested, TokenRefreshed, NotificationReceived
- Manage notification permission state and preferences

### Phase 4: UI Integration
- Add notification permission prompt on first launch
- Create NotificationSettingsScreen for user preferences
- Handle deep link navigation from notification tap
- Show in-app banner for foreground notifications

## Dependencies
- firebase_messaging package
- flutter_local_notifications package
- go_router for deep link navigation

## Risks
- HIGH: iOS permission handling (must request at right moment)
- MEDIUM: Background message handler runs in isolate (limited access)
- MEDIUM: FCM token refresh edge cases
- LOW: Notification channel configuration on Android

## Estimated Complexity: MEDIUM

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
```

## Important Notes

**CRITICAL**: The planner agent will **NOT** write any code until you explicitly confirm the plan with "yes" or "proceed" or similar affirmative response.

If you want changes, respond with:
- "modify: [your changes]"
- "different approach: [alternative]"
- "skip phase 2 and do phase 3 first"

## Integration with Other Commands

After planning:
- Use `/flutter-tdd` to implement with test-driven development
- Use `/flutter-build-fix` if build errors occur
- Use `/flutter-code-review` to review completed implementation

## Related Agents

This command invokes the `flutter-planner` agent located at:
`~/.claude/agents/flutter-planner.md`
