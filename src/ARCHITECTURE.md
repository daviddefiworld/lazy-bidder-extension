# Sidebar Architecture

This document describes the clean architecture implementation for the sidebar components.

## File Structure

```
src/
├── components/           # Reusable UI components
│   ├── index.ts         # Component exports
│   ├── Login.tsx        # Login form component
│   ├── Register.tsx     # Registration form component
│   ├── Header.tsx       # Header component
│   ├── StatusPanel.tsx  # Status display component
│   ├── ControlPanel.tsx # Extension control component
│   ├── UrlNavigation.tsx # URL navigation component
│   └── Footer.tsx       # Footer component
├── hooks/               # Custom React hooks
│   ├── index.ts         # Hook exports
│   ├── useSidebarState.ts      # State management and initialization hook
│   └── useSidebarActions.ts    # Action handlers hook
├── types/               # TypeScript type definitions
│   └── sidebar.ts       # Sidebar-specific types
└── sidebar/
    └── SidebarPage.tsx  # Main sidebar component
```

## Architecture Principles

### 1. Separation of Concerns
- **Components**: Pure UI components with minimal logic
- **Hooks**: Business logic and state management
- **Types**: Shared type definitions
- **Services**: External service integrations (existing)

### 2. Single Responsibility
Each component and hook has a single, well-defined responsibility:
- `Login.tsx` - Handles user authentication form
- `Register.tsx` - Handles user registration form
- `Header.tsx` - Displays user information
- `StatusPanel.tsx` - Shows extension and connection status
- `ControlPanel.tsx` - Extension activation controls
- `UrlNavigation.tsx` - URL navigation functionality
- `Footer.tsx` - Logout functionality

### 3. Custom Hooks for Logic
- `useSidebarState` - Manages component state and initialization
- `useSidebarActions` - Manages user actions

### 4. Type Safety
All components use TypeScript interfaces defined in `types/sidebar.ts` for:
- Props validation
- State management
- Event handlers

## Benefits

1. **Maintainability**: Each file has a single responsibility
2. **Reusability**: Components can be easily reused
3. **Testability**: Logic is separated from UI components
4. **Scalability**: Easy to add new features without affecting existing code
5. **Type Safety**: Full TypeScript support with proper interfaces

## Usage

The main `SidebarPage` component now acts as a coordinator, using:
- Custom hooks for state and logic
- Extracted components for UI rendering
- Clean separation between concerns

This architecture follows React best practices and makes the codebase more maintainable and scalable.
