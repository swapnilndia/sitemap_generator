# Requirements Document

## Introduction

This feature adds an environment URL dropdown to the file-to-JSON conversion process, allowing users to select from predefined environment URLs (dev, UAT, prod) instead of using the generic "example.com" placeholder. This will make the sitemap generation more practical for real-world deployment scenarios.

## Requirements

### Requirement 1

**User Story:** As a user converting files to JSON for sitemap generation, I want to select from predefined environment URLs so that I can generate sitemaps with the correct base URLs for different deployment environments.

#### Acceptance Criteria

1. WHEN the user is on the file conversion configuration page THEN the system SHALL display a dropdown with environment options
2. WHEN the user selects an environment from the dropdown THEN the system SHALL use the corresponding base URL for URL pattern generation
3. WHEN no environment is selected THEN the system SHALL default to a configurable default environment
4. WHEN the user types a custom URL pattern THEN the system SHALL allow manual override of the selected environment URL

### Requirement 2

**User Story:** As a user, I want to see three predefined environments (dev, UAT, prod) with their respective URLs so that I can easily switch between deployment targets.

#### Acceptance Criteria

1. WHEN the dropdown is opened THEN the system SHALL display "Development", "UAT", and "Production" options
2. WHEN "Development" is selected THEN the system SHALL use "https://bajaj-retail-dev.easypay.co.in" as the base URL
3. WHEN "UAT" is selected THEN the system SHALL use "https://bajaj-retail-uat.easypay.co.in" as the base URL
4. WHEN "Production" is selected THEN the system SHALL use "https://ondc.bajajfinservmarkets.in" as the base URL
5. WHEN an environment is selected THEN the URL pattern field SHALL automatically update to show the selected base URL

### Requirement 3

**User Story:** As a user, I want the environment selection to be persistent during my session so that I don't have to reselect it for multiple conversions.

#### Acceptance Criteria

1. WHEN the user selects an environment THEN the system SHALL remember the selection for the current session
2. WHEN the user navigates back to the conversion page THEN the system SHALL pre-select the previously chosen environment
3. WHEN the user refreshes the page THEN the system SHALL retain the environment selection using session storage
4. WHEN the user starts a new browser session THEN the system SHALL default to the configured default environment

### Requirement 4

**User Story:** As a developer, I want the environment URLs to be easily configurable so that I can modify or add new environments without code changes.

#### Acceptance Criteria

1. WHEN environments need to be modified THEN the system SHALL store environment configurations in a centralized configuration file
2. WHEN a new environment is added to the configuration THEN the system SHALL automatically include it in the dropdown
3. WHEN an environment URL is changed in the configuration THEN the system SHALL reflect the change immediately
4. WHEN the configuration is invalid THEN the system SHALL fall back to default values and log an error