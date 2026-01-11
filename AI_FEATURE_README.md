# AI Question Feature

## Overview
The cluster view now includes an AI-powered question generator that uses Claude to create thoughtful, discussion-provoking questions based on the scripture verses in each node.

## Features
- **Single Button Interface**: Click "Ask AI a Question" to generate a custom question
- **Claude 3.5 Sonnet**: Uses the latest Claude model for intelligent question generation
- **Context-Aware**: Questions are generated based on the specific scripture passage
- **Discussion-Focused**: Questions are designed to encourage group reflection and meaningful conversation

## Setup

### 1. Get a Claude API Key
1. Visit [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign up or log in to your account
3. Navigate to API Keys
4. Create a new API key (starts with `sk-ant-...`)

### 2. Enter Your API Key
1. Navigate to the cluster view in the application
2. Click the "Ask AI a Question" button
3. On first use, you'll be prompted to enter your API key
4. Paste your API key and click "Save & Generate Question"
5. Your key is securely stored in browser localStorage for future use

## Usage

1. **Navigate through the study**: Use the guided mode to move through each scripture node
2. **Generate a question**: Click the "Ask AI a Question" button at any node
3. **Review the question**: The AI will generate a thoughtful discussion question based on the verses
4. **Discuss**: Use the question to facilitate group conversation

## Question Characteristics

The AI generates questions that are:
- **Open-ended**: Not yes/no questions
- **Reflective**: Encourage personal introspection
- **Applicable**: Connect scripture to everyday life
- **Discussion-worthy**: Spark meaningful group conversations
- **Concise**: 1-2 sentences for easy reading

## Example Questions

For James 1:2-4:
> "How might viewing your current challenges as opportunities for growth change the way you approach them this week?"

For Romans 12:2:
> "What specific area of your thinking needs renewal, and what practical step could you take to begin that transformation?"

## Technical Details

- **Model**: Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`)
- **API**: Anthropic Messages API
- **Token Limit**: 200 tokens per question
- **Storage**: API key stored in localStorage
- **Error Handling**: Clear error messages for API issues or missing data

## Privacy & Security

- API keys are stored only in your browser's localStorage
- Keys are never sent to any server except Anthropic's API
- Scripture text is only sent to Claude when generating questions
- No conversation history is retained between requests

## Troubleshooting

### "Claude API key not set"
- Click the button again and enter your API key when prompted

### "No scripture text available for this node"
- Ensure the node has loaded its scripture verses
- Try switching modes or refreshing the visualization

### "Failed to generate question"
- Check your API key is valid
- Ensure you have API credits available
- Check your internet connection
- Review the error message for specific details

## Cost Considerations

Claude API usage is billed based on:
- Input tokens (scripture text + prompt)
- Output tokens (generated question)

Each question generation typically uses:
- ~150-250 input tokens
- ~30-50 output tokens

At current pricing, this is approximately $0.0001-0.0002 per question.

## Future Enhancements

Potential improvements:
- Multiple question styles (theological, practical, historical)
- Question history and favorites
- Group discussion mode with follow-up questions
- Integration with other AI providers
- Offline question bank
