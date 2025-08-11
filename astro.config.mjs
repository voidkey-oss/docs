// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	integrations: [
		mermaid(),
		starlight({
			title: 'Voidkey',
			description: 'Zero-trust credential broker for secure cloud access',
			logo: {
				light: './src/assets/voidkey_black_no_bg.svg',
				dark: './src/assets/voidkey_white_no_bg.svg',
				alt: 'Voidkey Logo',
				replacesTitle: true,
			},
			customCss: [
				'./src/styles/custom.css',
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/voidkey-oss' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'index' },
						{ label: 'Quick Start', slug: 'getting-started/quickstart' },
						{ label: 'Installation', slug: 'getting-started/installation' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Components', slug: 'architecture/components' },
						{ label: 'Security Model', slug: 'architecture/security' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'Configuration Guide', slug: 'configuration/guide' },
						{ label: 'Identity Providers', slug: 'configuration/identity-providers' },
						{ label: 'Access Providers', slug: 'configuration/access-providers' },
						{ label: 'Examples', slug: 'configuration/examples' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'REST API', slug: 'api/rest' },
						{ label: 'Endpoints', slug: 'api/endpoints' },
						{ label: 'Authentication', slug: 'api/authentication' },
					],
				},
				{
					label: 'CLI Reference',
					items: [
						{ label: 'Installation', slug: 'cli/installation' },
						{ label: 'Commands', slug: 'cli/commands' },
						{ label: 'Configuration', slug: 'cli/configuration' },
					],
				},
				{
					label: 'Providers',
					items: [
						{ label: 'Identity Providers', slug: 'providers/identity' },
						{ label: 'Access Providers', slug: 'providers/access' },
						{ label: 'Custom Providers', slug: 'providers/custom' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Development Setup', slug: 'development/setup' },
						{ label: 'Testing', slug: 'development/testing' },
						{ label: 'Contributing', slug: 'development/contributing' },
					],
				},
				{
					label: 'Deployment',
					items: [
						{ label: 'Docker', slug: 'deployment/docker' },
						{ label: 'Kubernetes', slug: 'deployment/kubernetes' },
						{ label: 'Production', slug: 'deployment/production' },
					],
				},
				{
					label: 'Examples',
					items: [
						{ label: 'GitHub Actions', slug: 'examples/github-actions' },
						{ label: 'CI/CD Pipelines', slug: 'examples/cicd' },
						{ label: 'Local Development', slug: 'examples/local-dev' },
					],
				},
			],
		}),
	],
});
