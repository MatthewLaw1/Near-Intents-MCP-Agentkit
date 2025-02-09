# Crew AI MCP Server

[![smithery badge](https://smithery.ai/badge/@MatthewLaw1/Near-Intents-MCP-Agentkit)](https://smithery.ai/server/@MatthewLaw1/Near-Intents-MCP-Agentkit)

An MCP server that provides AI agent and task management capabilities using the CrewAI framework.

## Setup

### Installing via Smithery

To install Crew AI MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@MatthewLaw1/Near-Intents-MCP-Agentkit):

```bash
npx -y @smithery/cli install @MatthewLaw1/Near-Intents-MCP-Agentkit --client claude
```

### Manual Installation
1. Clone or fork this repository
2. Run the setup script:
```bash
./crew.sh
```

The setup script will:
- Install required Python dependencies
- Configure the MCP settings file for your system
- Set up the correct paths automatically

## Configuration

Before using the server, set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key"
```

## Usage

The server provides three main tools:

### 1. Create an Agent
```json
{
    "method": "call_tool",
    "params": {
        "name": "create_agent",
        "arguments": {
            "role": "researcher",
            "goal": "Research and analyze information effectively",
            "backstory": "An experienced research analyst"
        }
    }
}
```

### 2. Create a Task
```json
{
    "method": "call_tool",
    "params": {
        "name": "create_task",
        "arguments": {
            "description": "Analyze recent market trends",
            "agent": "researcher",
            "expected_output": "A detailed analysis report"
        }
    }
}
```

### 3. Create and Run a Crew
```json
{
    "method": "call_tool",
    "params": {
        "name": "create_crew",
        "arguments": {
            "agents": ["researcher"],
            "tasks": ["Analyze recent market trends"],
            "verbose": true
        }
    }
}
```

### Example Usage

Create and run a complete workflow:
```bash
(echo '{"method": "call_tool", "params": {"name": "create_agent", "arguments": {"role": "researcher", "goal": "Research and analyze information effectively", "backstory": "An experienced research analyst"}}}'; echo '{"method": "call_tool", "params": {"name": "create_task", "arguments": {"description": "Analyze recent market trends", "agent": "researcher", "expected_output": "A detailed analysis report"}}}'; echo '{"method": "call_tool", "params": {"name": "create_crew", "arguments": {"agents": ["researcher"], "tasks": ["Analyze recent market trends"], "verbose": true}}}') | python3 src/crew_server.py
```

## System Requirements

- Python 3.8 or higher
- `jq` command-line tool (for setup script)
- VSCode with Roo Cline extension installed

## Supported Platforms

- macOS
- Linux
- Windows (via Git Bash)

## Troubleshooting

If you encounter any issues:

1. Ensure your OpenAI API key is set correctly
2. Check that all dependencies are installed (`pip install -r requirements.txt`)
3. Verify the MCP settings file exists and has the correct configuration
4. Make sure the server path in the MCP settings matches your actual file location

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Run the setup script to verify everything works
5. Submit a pull request
