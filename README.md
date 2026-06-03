# CCControl

A powerful CLI-powered agent orchestration framework for rapid prototyping and execution of complex workflows.

## Project Overview

CCControl is a modular architecture enabling seamless integration of modes (Telegram, web, browser agent), tools (AI, diff, approval), and plans. The Browser Agent mode introduces headless browser automation via Playwright for advanced web-based tasks.

### Key Features
- **Modular Design** - Plug-in modes/tools without core changes
- **LLM Orchestration** - Smart task decomposition via agents
- **Approval Workflow** - Interactive safeguards for critical actions
- **Diff Viewer** - Visual change comparisons
- **Web Tools Integration** - 
  - `plan/web-tools.ts`: Firecrawl-powered web search, URL scraping, HTTP GET
  - Wikipedia query integration
  - Browser Agent for full web automation
- **Browser Agent** - Playwright-driven headless browsing with iterative refinement
  - Supports form filling, navigation, and screenshot capture
  - Iterative Plan/Execute/Evaluate cycle (up to 5 cycles)
- **CLI Mode Enhancements** - Browse Agent selection via CLI sub-mode menu

## Browser Agent Workflow

The Browser Agent follows a structured iterative process:

1. **Plan**: LLM generates web automation plan with steps and expected outcomes
2. **Execute**: Stagehand handles clicks, navigations, and interactions
3. **Evaluate**: Quality scoring with feedback assessment
4. **Iterate**: Up to 5 refinement cycles based on evaluation results

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/CCControl.git
cd CCControl

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Required
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key

# Optional (depending on features used)
FIRECRAWL_API_KEY=your_firecrawl_api_key
TELEGRAM_BOT_TOKEN=your_telegram_token
```

## Getting Started

### Browser Agent Example

```bash
# Build the project
npm run build

# Run browser agent
node dist/index.js browser-agent --prompt "Scrape product reviews from amazon.com"
```

### CLI Usage

```bash
# View available commands
node dist/index.js --help

# Run with specific mode
node dist/index.js browser-agent --prompt "Your task here"
```

## Architecture

```
[CLI] -> [Orchestrator] -> [Agent] -> [Browser Agent] -> [Stagehand]
```

### Project Structure

```
CCControl/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── orchestrator.ts   # Workflow orchestrator
│   ├── modes/           # Different interaction modes
│   ├── tools/           # Utility tools and integrations
│   └── plans/           # Task-specific plan implementations
├── plan/
│   └── browser-agent/   # Browser agent implementation
├── dist/                # Compiled JavaScript output
└── package.json
```

## Available Modes

- **Browser Agent**: Headless browser automation via Playwright
- **Telegram**: Telegram bot integration for messaging workflows
- **Web Tools**: Web scraping and search capabilities

## Available Tools

- **AI Tools**: LLM-powered task processing
- **Diff Viewer**: Visual comparison of changes
- **Approval System**: Interactive confirmation for critical actions

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Stagehand](https://github.com/stagehandai/stagehand) for browser automation
- Powered by [Firecrawl](https://www.firecrawl.dev/) for web scraping capabilities
- LLM orchestration via Google Generative AI