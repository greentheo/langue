# Model Configuration in Langue

This document provides detailed information about AI model configuration, selection, and usage in the Langue language learning application.

## Overview

Langue supports multiple AI model backends to power its language learning activities:

1. **Local Models** via Ollama (offline, runs on your machine)
2. **Cloud Models** like Claude or OpenAI (requires API keys and internet connection)

The application is designed to automatically discover available models, allow interactive selection, and provide fallback mechanisms if a model becomes unavailable.

## Model Discovery

When Langue starts, it automatically:

1. Checks for local Ollama models by querying the Ollama API
2. Verifies if API keys are present for cloud models
3. Builds a list of available models for selection

## Model Selection

### Interactive Selection

If no model is configured or the configured model isn't available, Langue will prompt you to select a model:

```
Please select an Ollama model to use:
  1. llama3.2:3b
  2. llama2:latest
  3. qwen2.5-coder:latest
  4. llama3.2:latest
Enter your choice (1):
```

### Configuration Methods

You can configure your preferred model in multiple ways:

1. **Environment Variables**:
   ```bash
   # Set directly in your terminal
   export OLLAMA_MODEL=llama3.2
   ```

2. **.env File**:
   Create a `.env` file in the project root with the following content:
   ```
   OLLAMA_MODEL=llama3.2
   OLLAMA_SERVER=http://localhost:11434
   ```

3. **Configuration File**:
   The settings are stored in `~/.config/langue/config.toml` and can be edited directly:
   ```toml
   [ollama]
   model_name = "llama3.2"
   server = "http://localhost:11434"
   ```

4. **Settings Menu**:
   Use the settings menu in the application:
   ```
   Settings > Change Model
   ```

## Available Models

### Local Models (Ollama)

Ollama provides various open-source language models that can run locally on your machine:

- **llama3.2** - Meta's Llama 3.2 model (recommended)
- **llama2** - Meta's Llama 2 model
- **mistral** - Mistral 7B model
- **gemma** - Google's Gemma model
- **qwen2** - Alibaba's Qwen2 model
- Many others...

You can install additional models with Ollama using:
```bash
ollama pull model_name
```

### Cloud Models

For cloud models, you'll need to obtain API keys:

1. **Claude** (Anthropic):
   - Requires `ANTHROPIC_API_KEY` environment variable
   - Supports Claude Haiku and Sonnet models

2. **OpenAI**:
   - Requires `OPENAI_API_KEY` environment variable
   - Supports GPT-3.5 and GPT-4 models

## Model Capabilities

Different models have different capabilities:

| Model | Offline | Languages | Context Window | Strengths |
|-------|---------|-----------|----------------|-----------|
| llama3.2 | ✅ | 25+ | 4K-8K | Balanced performance, good for most activities |
| llama2 | ✅ | 20+ | 4K | Good stability, widely tested |
| mistral | ✅ | 20+ | 8K | Good performance on longer contexts |
| Claude | ❌ | 100+ | 200K | Excellent at instruction following, large context window |
| GPT-4 | ❌ | 100+ | 8K-32K | High accuracy, multilingual capabilities |

## Troubleshooting

### Common Issues

1. **"No Ollama models detected"**:
   - Ensure Ollama is installed and running
   - Check if the Ollama server is running at the default port (11434)
   - Try running `ollama list` in your terminal

2. **Model connection errors**:
   - Verify Ollama is running with `ollama serve`
   - Check if the model is downloaded with `ollama list`
   - Try pulling the model again with `ollama pull model_name`

3. **Cloud model errors**:
   - Verify API keys are correctly set
   - Check your internet connection
   - Ensure you haven't exceeded API rate limits

### Checking Model Status

You can check the status of your models using:

```bash
# For Ollama
ollama list

# For Langue's detected models
langue settings --list
```

## Advanced Configuration

### Model-Specific Parameters

You can adjust model parameters in the configuration:

```toml
[ollama]
model_name = "llama3.2"
temperature = 0.7  # Controls randomness (0.0-1.0)
max_tokens = 1000  # Maximum response length
```

### Fallback Strategy

If the primary model is unavailable, Langue will attempt to use a fallback model:

```toml
primary_model = "ollama"
fallback_model = "claude"
```

## Best Practices

1. **For best offline experience**:
   - Use Ollama models, preferably llama3.2 or mistral
   - Ensure models are pre-downloaded before going offline

2. **For best quality**:
   - Use Claude or GPT-4 if you have API keys
   - These provide higher accuracy for language learning feedback

3. **For slower machines**:
   - Use smaller Ollama models (7B or smaller)
   - Set lower `max_tokens` values

4. **For language specialists**:
   - Some models have better multilingual capabilities
   - Claude and GPT-4 generally perform better for non-European languages