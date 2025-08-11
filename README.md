# Voidkey Documentation

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

This repository contains the documentation website for Voidkey, a zero-trust credential broker system. The documentation is built using [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/).

## 🔗 Live Documentation

Visit the live documentation at: [docs.voidkey.com](https://docs.voidkey.com) *(coming soon)*

## 📚 About Voidkey

Voidkey is a zero-trust credential broker that eliminates the need for long-lived secrets by dynamically minting short-lived, scoped credentials using OIDC-based authentication.

**Key Components:**
- **[broker-core](https://github.com/voidkey-oss/broker-core)** - TypeScript core library
- **[broker-server](https://github.com/voidkey-oss/broker-server)** - NestJS HTTP server
- **[cli](https://github.com/voidkey-oss/cli)** - Go CLI client
- **[sandbox](https://github.com/voidkey-oss/sandbox)** - Docker development environment

## 🚀 Development

### Prerequisites
- Node.js 18+ 
- npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/voidkey-oss/docs.git
cd docs

# Install dependencies
npm install

# Start development server
npm run dev
```

The documentation will be available at `http://localhost:4321`

### Project Structure

```
.
├── public/                 # Static assets (favicons, logos)
├── src/
│   ├── assets/            # Images and static assets for content
│   ├── components/        # Custom Astro components
│   ├── content/
│   │   └── docs/          # Documentation content (.md/.mdx files)
│   ├── styles/            # Custom CSS styles
│   └── content.config.ts  # Content configuration
├── astro.config.mjs       # Astro configuration
├── package.json
└── tsconfig.json
```

### Content Organization

Documentation content is organized in `src/content/docs/`:

- `getting-started/` - Installation and quickstart guides
- `architecture/` - System architecture and components
- `configuration/` - Identity and access provider setup
- `api/` - REST API reference and authentication
- `cli/` - CLI usage and commands
- `deployment/` - Production deployment guides
- `development/` - Contributing and development setup
- `examples/` - Usage examples and CI/CD integration
- `providers/` - Identity and access provider guides

### Available Commands

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Install dependencies                            |
| `npm run dev`             | Start development server at `localhost:4321`    |
| `npm run build`           | Build production site to `./dist/`              |
| `npm run preview`         | Preview production build locally                 |
| `npm run astro ...`       | Run Astro CLI commands                          |
| `npm run astro check`     | Check for errors in content                     |

## 📝 Contributing

We welcome contributions to improve the documentation!

1. Fork the repository
2. Create a feature branch (`git checkout -b improve-docs`)
3. Make your changes
4. Test locally with `npm run dev`
5. Submit a pull request

### Writing Guidelines

- Use clear, concise language
- Include code examples where helpful
- Test all commands and examples
- Follow the existing content structure
- Add images to `src/assets/` when needed

## 📄 License

This documentation is part of the Voidkey project. See the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Voidkey Organization](https://github.com/voidkey-oss)
- [Report Issues](https://github.com/voidkey-oss/.github/issues/new/choose)
- [Security Policy](https://github.com/voidkey-oss/.github/blob/main/SECURITY.md)
- [Contributing Guidelines](https://github.com/voidkey-oss/.github/blob/main/CONTRIBUTING.md)
