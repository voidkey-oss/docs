---
title: Contributing Guide
description: How to contribute to the Voidkey project
---

Thank you for your interest in contributing to Voidkey! This guide will help you get started with contributing to the project.

## Getting Started

### Prerequisites

Before contributing, make sure you have:

- **Node.js** 18+ and npm 9+
- **Go** 1.21+
- **Docker** and Docker Compose
- **Git**
- Familiarity with TypeScript, Go, and containerization

### Setting Up Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/voidkey.git
   cd voidkey
   ```

2. **Install Dependencies**
   ```bash
   # Install Node.js dependencies
   cd broker-core && npm install
   cd ../broker-server && npm install
   
   # Install Go dependencies
   cd ../cli && go mod download
   ```

3. **Start Development Environment**
   ```bash
   cd ../sandbox
   docker-compose up -d
   ```

See the [Development Setup](/development/setup/) guide for detailed instructions.

## How to Contribute

### Types of Contributions

We welcome several types of contributions:

- **🐛 Bug Reports**: Help us identify and fix issues
- **✨ Feature Requests**: Suggest new functionality
- **📝 Documentation**: Improve or add documentation
- **🔧 Code Contributions**: Fix bugs or implement features
- **🧪 Testing**: Add or improve tests
- **🎨 UI/UX**: Improve user experience

### Before You Start

1. **Check Existing Issues**: Look for existing issues or discussions related to your contribution
2. **Create an Issue**: For significant changes, create an issue to discuss the approach
3. **Assign Yourself**: Comment on the issue to let others know you're working on it

## Development Workflow

### 1. Create a Branch

Create a descriptive branch name:

```bash
# Feature branches
git checkout -b feature/add-azure-provider
git checkout -b feature/improve-error-handling

# Bug fix branches
git checkout -b fix/token-validation-issue
git checkout -b fix/memory-leak-in-server

# Documentation branches
git checkout -b docs/update-api-reference
git checkout -b docs/add-examples
```

### 2. Make Changes

Follow our coding standards and best practices:

#### TypeScript (broker-core, broker-server)

- Use TypeScript strict mode
- Follow existing code style and patterns
- Add proper type definitions
- Include JSDoc comments for public APIs
- Use dependency injection where appropriate

Example:
```typescript
/**
 * Validates an OIDC token and returns claims
 * @param token - The OIDC token to validate
 * @returns Promise resolving to token claims
 * @throws Error if token is invalid
 */
async validateToken(token: string): Promise<TokenClaims> {
  // Implementation
}
```

#### Go (CLI)

- Follow Go conventions and idioms
- Use `gofmt` for formatting
- Add proper error handling
- Include tests for new functionality
- Use structured logging

Example:
```go
func mintCredentials(keys []string) (*Credentials, error) {
    if len(keys) == 0 {
        return nil, fmt.Errorf("at least one key must be specified")
    }
    
    // Implementation
}
```

### 3. Add Tests

All contributions should include appropriate tests:

#### Unit Tests

```typescript
// TypeScript unit test
describe('NewFeature', () => {
  it('should handle valid input correctly', () => {
    const result = newFeature('valid-input');
    expect(result).toBe('expected-output');
  });

  it('should throw error for invalid input', () => {
    expect(() => newFeature('invalid')).toThrow('Invalid input');
  });
});
```

```go
// Go unit test
func TestNewFeature(t *testing.T) {
    result, err := NewFeature("valid-input")
    assert.NoError(t, err)
    assert.Equal(t, "expected-output", result)
    
    _, err = NewFeature("invalid")
    assert.Error(t, err)
}
```

#### Integration Tests

Add integration tests for new features that interact with external services or multiple components.

### 4. Update Documentation

Update relevant documentation:

- **API Documentation**: Update if you've changed API interfaces
- **Configuration**: Update if you've added new configuration options
- **README**: Update if installation or usage has changed
- **Examples**: Add examples for new features

### 5. Run Tests and Checks

Before submitting, ensure all tests pass:

```bash
# TypeScript tests
cd broker-core && npm test
cd ../broker-server && npm test

# Go tests
cd ../cli && go test ./...

# Integration tests
cd ../broker-server && npm run test:integration

# Linting
cd ../broker-core && npm run lint
cd ../broker-server && npm run lint
cd ../cli && golangci-lint run
```

### 6. Commit Changes

Use conventional commit messages:

```bash
# Format: type(scope): description
git commit -m "feat(providers): add Azure AD identity provider"
git commit -m "fix(cli): resolve token validation issue"
git commit -m "docs(api): update authentication examples"
git commit -m "test(core): add unit tests for token validation"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

### 7. Push and Create Pull Request

```bash
git push origin your-branch-name
```

Then create a pull request on GitHub with:

- **Clear title** describing the change
- **Detailed description** explaining what and why
- **Reference to related issues** (e.g., "Fixes #123")
- **Testing notes** if applicable

## Pull Request Guidelines

### PR Template

We use a pull request template. Make sure to:

1. **Fill out all sections** of the template
2. **Link related issues** using keywords like "Fixes #123"
3. **Describe testing** done for the changes
4. **Add screenshots** for UI changes
5. **Check all boxes** in the checklist

### Review Process

1. **Automated Checks**: CI/CD pipelines run tests and checks
2. **Code Review**: Maintainers review code for quality and style
3. **Testing**: Changes are tested in integration environment
4. **Approval**: At least one maintainer approval required
5. **Merge**: Squash and merge to main branch

### What We Look For

- **Code Quality**: Clean, readable, and maintainable code
- **Test Coverage**: Adequate test coverage for new functionality
- **Documentation**: Updated documentation for changes
- **Security**: No security vulnerabilities introduced
- **Performance**: No significant performance regressions
- **Backward Compatibility**: Maintain API compatibility where possible

## Coding Standards

### Code Style

#### TypeScript

```typescript
// Use explicit types
interface UserConfig {
  name: string;
  age: number;
  isActive: boolean;
}

// Use async/await instead of Promises
async function fetchData(): Promise<Data> {
  const response = await fetch('/api/data');
  return response.json();
}

// Use proper error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw new Error('Failed to complete operation');
}
```

#### Go

```go
// Use proper error handling
func processData(data []byte) (*Result, error) {
    if len(data) == 0 {
        return nil, fmt.Errorf("data cannot be empty")
    }
    
    result, err := parseData(data)
    if err != nil {
        return nil, fmt.Errorf("failed to parse data: %w", err)
    }
    
    return result, nil
}

// Use structured logging
logger.Info("Processing request",
    "user", userID,
    "keys", requestedKeys,
    "duration", duration)
```

### Naming Conventions

- **TypeScript**: Use `camelCase` for variables and functions, `PascalCase` for classes and interfaces
- **Go**: Use Go conventions (`camelCase` for unexported, `PascalCase` for exported)
- **Files**: Use `kebab-case` for file names
- **Directories**: Use `kebab-case` for directory names

### Project Structure

Follow the established project structure:

```
voidkey/
├── broker-core/          # Core TypeScript library
│   ├── src/
│   │   ├── providers/    # Provider implementations
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utility functions
│   │   └── types/        # Type definitions
│   └── __tests__/        # Tests
├── broker-server/        # NestJS HTTP server
│   ├── src/
│   │   ├── modules/      # NestJS modules
│   │   ├── controllers/  # HTTP controllers
│   │   ├── services/     # Business services
│   │   └── dto/          # Data transfer objects
│   └── test/             # Tests
├── cli/                  # Go CLI application
│   ├── cmd/              # CLI commands
│   ├── internal/         # Internal packages
│   └── main.go           # Entry point
└── docs/                 # Documentation
```

## Specific Contribution Areas

### Adding New Providers

#### Identity Providers

1. **Create Provider Class**
   ```typescript
   // broker-core/src/providers/idp/my-idp.provider.ts
   export class MyIdpProvider implements IdpProvider {
     // Implementation
   }
   ```

2. **Add Tests**
   ```typescript
   // broker-core/src/providers/idp/__tests__/my-idp.provider.test.ts
   describe('MyIdpProvider', () => {
     // Tests
   });
   ```

3. **Register Provider**
   ```typescript
   // broker-server/src/providers/providers.service.ts
   // Add to provider factory
   ```

4. **Update Documentation**
   - Add to [Identity Providers](/providers/identity/) page
   - Add configuration example
   - Add usage example

#### Access Providers

Similar process for access providers - implement interface, add tests, register, and document.

### Improving Error Handling

1. **Define Error Types**
   ```typescript
   export class ValidationError extends Error {
     constructor(message: string, public field: string) {
       super(message);
       this.name = 'ValidationError';
     }
   }
   ```

2. **Use Consistent Error Messages**
   ```typescript
   if (!token) {
     throw new ValidationError('Token is required', 'token');
   }
   ```

3. **Add Error Tests**
   ```typescript
   it('should throw ValidationError for missing token', () => {
     expect(() => validateToken('')).toThrow(ValidationError);
   });
   ```

### Adding CLI Features

1. **Create Command**
   ```go
   // cli/cmd/mycommand.go
   func newMyCommand() *cobra.Command {
     // Implementation
   }
   ```

2. **Add to Root Command**
   ```go
   // cli/cmd/root.go
   func init() {
     rootCmd.AddCommand(newMyCommand())
   }
   ```

3. **Add Tests**
   ```go
   // cli/cmd/mycommand_test.go
   func TestMyCommand(t *testing.T) {
     // Tests
   }
   ```

## Getting Help

### Communication Channels

- **GitHub Issues**: For bugs, feature requests, and discussions
- **GitHub Discussions**: For questions and community discussions
- **Discord**: For real-time chat (link in repository)

### Finding Good First Issues

Look for issues labeled:
- `good first issue`: Perfect for new contributors
- `help wanted`: Community help needed
- `documentation`: Documentation improvements
- `beginner friendly`: Easy to get started

### Mentorship

New contributors can:
- Ask questions in GitHub discussions
- Request mentorship in Discord
- Pair program with maintainers (by arrangement)

## Recognition

Contributors are recognized through:

- **Contributors List**: Added to README and documentation
- **Release Notes**: Mentioned in release notes
- **Hall of Fame**: Featured contributors highlighted
- **Swag**: Stickers and other swag for significant contributors

## Security

### Reporting Security Issues

For security vulnerabilities:

1. **Do not create public issues**
2. **Email security@voidkey.io** with details
3. **Use encrypted communication** if possible
4. **Wait for acknowledgment** before disclosure

### Security Guidelines

- Never commit secrets or credentials
- Use secure coding practices
- Validate all inputs
- Follow principle of least privilege
- Keep dependencies updated

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Release Schedule

- **Minor releases**: Monthly
- **Patch releases**: As needed
- **Major releases**: Quarterly or when breaking changes accumulate

## License

By contributing to Voidkey, you agree that your contributions will be licensed under the same license as the project (Apache 2.0 License).

## Code of Conduct

Please read and follow our [Code of Conduct](https://github.com/voidkey-oss/voidkey/blob/main/CODE_OF_CONDUCT.md). We are committed to providing a welcoming and inclusive environment for all contributors.

## Thank You

Thank you for contributing to Voidkey! Your contributions help make secure credential management accessible to everyone.

## Next Steps

- [Development Setup](/development/setup/) - Set up your development environment
- [Testing Guide](/development/testing/) - Learn about our testing practices
- [API Reference](/api/rest/) - Understand the API structure
- [Architecture Overview](/architecture/overview/) - Learn the system architecture