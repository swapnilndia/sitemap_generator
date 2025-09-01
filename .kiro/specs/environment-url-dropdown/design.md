# Design Document

## Overview

The environment URL dropdown feature enhances the file-to-JSON conversion process by providing predefined environment URLs. This eliminates the need for users to manually type environment URLs and reduces errors in sitemap generation.

## Architecture

### Component Structure
```
FileUploadComponent
├── EnvironmentSelector (new)
│   ├── Dropdown with environment options
│   └── URL pattern preview
└── Existing conversion configuration
```

### Data Flow
1. User selects environment from dropdown
2. Environment selection updates URL pattern field
3. URL pattern is used in JSON conversion process
4. Generated URLs use the selected environment base URL

## Components and Interfaces

### 1. Environment Configuration

**File:** `lib/environments.js`
```javascript
export const ENVIRONMENTS = {
  dev: {
    name: 'Development',
    baseUrl: 'https://bajaj-retail-dev.easypay.co.in',
    description: 'Development environment'
  },
  uat: {
    name: 'UAT',
    baseUrl: 'https://bajaj-retail-uat.easypay.co.in',
    description: 'User Acceptance Testing environment'
  },
  prod: {
    name: 'Production',
    baseUrl: 'https://ondc.bajajfinservmarkets.in',
    description: 'Production environment'
  }
};

export const DEFAULT_ENVIRONMENT = 'dev';
```

### 2. Environment Selector Component

**File:** `components/EnvironmentSelector.js`
- Dropdown with environment options
- URL pattern preview
- Session storage integration
- Props: `onEnvironmentChange`, `selectedEnvironment`, `urlPattern`

### 3. Enhanced File Upload Component

**Modifications to:** `components/FileUploadComponent.js`
- Integrate EnvironmentSelector
- Update URL pattern based on environment selection
- Maintain backward compatibility with manual URL input

### 4. Session Storage Utility

**File:** `lib/sessionStorage.js`
- Store/retrieve environment selection
- Handle session persistence
- Provide fallback mechanisms

## Data Models

### Environment Object
```javascript
{
  id: string,           // 'dev', 'uat', 'prod'
  name: string,         // Display name
  baseUrl: string,      // Full base URL
  description: string   // Environment description
}
```

### Configuration State
```javascript
{
  selectedEnvironment: string,  // Environment ID
  urlPattern: string,          // Generated or custom URL pattern
  isCustomPattern: boolean     // Whether user overrode the pattern
}
```

## Error Handling

### Invalid Environment Selection
- Fall back to default environment
- Log warning message
- Display user-friendly error message

### Session Storage Failures
- Gracefully degrade to default environment
- Continue functionality without persistence
- Log errors for debugging

### Configuration Loading Errors
- Use hardcoded fallback environments
- Display warning to user
- Log detailed error information

## Testing Strategy

### Unit Tests
- Environment configuration loading
- URL pattern generation
- Session storage operations
- Component rendering and interactions

### Integration Tests
- End-to-end environment selection flow
- URL pattern application in conversion
- Session persistence across page reloads

### User Acceptance Tests
- Environment dropdown functionality
- URL pattern updates
- Conversion with different environments
- Session persistence validation

## Implementation Considerations

### Performance
- Lazy load environment configurations
- Minimize re-renders on environment changes
- Cache environment data in memory

### Accessibility
- Proper ARIA labels for dropdown
- Keyboard navigation support
- Screen reader compatibility
- High contrast support

### Browser Compatibility
- Session storage feature detection
- Fallback for older browsers
- Progressive enhancement approach

### Security
- Validate environment URLs
- Sanitize user inputs
- Prevent XSS in URL patterns

## Migration Strategy

### Backward Compatibility
- Existing URL patterns continue to work
- No breaking changes to API
- Graceful fallback for missing configurations

### Deployment
- Feature flag for gradual rollout
- A/B testing capability
- Easy rollback mechanism

## Future Enhancements

### Custom Environment Management
- Allow users to add custom environments
- Environment management interface
- Import/export environment configurations

### Advanced URL Patterns
- Support for multiple URL patterns per environment
- Conditional URL generation based on data
- Template variables in URL patterns