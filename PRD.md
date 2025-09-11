# Product Requirements Document: Langue - CLI Language Learning Tool

## 1. Product Overview

Langue is a command-line language learning application powered by AI language models (both cloud-based and local). It provides an accessible, efficient way for users to learn and practice languages through various interactive activities and conversational practice, all within their terminal environment. The application works with local models via Ollama for offline usage or with cloud models like Claude Haiku 3.5 for enhanced capabilities.

## 2. Target Users

- Language learners who want a command-line interfaces
- Developers and technically-oriented individuals
- Users seeking cost-effective language learning solutions
- People who want to practice languages in short, focused sessions

## 3. User Stories

1. As a language learner, I want to choose from multiple learning activities so I can vary my practice methods.
2. As a busy professional, I want quick, focused language practice sessions available through my terminal.
3. As a learner, I want to track my progress so I can see my improvement over time.
4. As a beginner, I want adjustable difficulty levels so I can learn at my own pace.
5. As an advanced learner, I want sophisticated conversation practice to improve my fluency.
6. As a user, I want to be able to select from multiple languages to learn.

## 4. Feature Requirements

### 4.1 Core Functionality

- **Multi-language Support**: Support for a wide range of languages, depending on the capabilities of the chosen AI model
- **Command-line Interface**: Simple, intuitive terminal-based interface
- **Activity Selection**: Menu to choose different learning activities
- **Course System**: Structured sets of activities that can run in loops
- **Progress Tracking**: Score system to monitor words learned and practice consistency

### 4.2 Learning Activities

- **Flashcards**: Traditional vocabulary practice with spaced repetition
- **Fill-in-the-Blank**: Sentence completion exercises with varying difficulty
- **Word Matching**: Matching words to their translations or definitions
- **Conversation Practice**: Simulated dialogues with adjustable complexity levels
- **Vocabulary Quizzes**: Testing knowledge of previously learned words
- **Translation Exercises**: Translating phrases between languages
- **Reading Comprehension**: A paragraph is generated and user answers questions about the paragraph.

### 4.3 Chat Functionality

- **Adjustable Language Level**: From beginner (A1) to advanced (C2)
- **Contextual Conversations**: Chat about specific topics or scenarios
- **Grammar Correction**: Real-time feedback on grammatical errors
- **Vocabulary Explanation**: Definitions and usage examples for unfamiliar words
- **Cultural Context**: Information about cultural aspects of language usage

### 4.4 Progress Tracking

- **Word Count**: Tracking of total unique words learned
- **Points System**: Points awarded for every learning attempt
- **Streak Tracking**: Days of consecutive learning
- **Progress Visualization**: Simple charts showing improvement over time
- **Achievement System**: Milestones to celebrate learning progress

### 4.5 Technical Requirements

- **Python-based Implementation**: Built using Python for cross-platform compatibility
- **Flexible Model Integration**: Support for multiple AI models including:
  - Claude Haiku 3.5 via Anthropic API
  - Local models via Ollama
  - Other online models (ChatGPT, etc.)
- **Local Data Storage**: Saving user progress and preferences
- **Efficient Resource Usage**: Minimizing API calls for cost optimization
- **Full Offline Capability**: Complete functionality available without internet connection when using local models

## 5. User Experience

### 5.1 Application Flow

1. User launches the application
1. User sees their score, and language practice stats, last login, and more.
2. User selects a language to learn/practice
3. User chooses an activity or continues a course
4. User completes the activity and receives feedback/points
5. User can choose another activity or exit

### 5.2 Interface Requirements

- Clean, readable terminal interface
- Consistent command patterns
- Clear instructions and help documentation
- Intuitive navigation between activities
- Visual differentiation between user input and system output

## 6. Performance Requirements

- Fast startup time (<2 seconds)
- Quick response time for non-AI activities (<1 second)
- Reasonable response time for AI-powered features (<5 seconds)
- Graceful handling of network interruptions
- Efficient local storage usage

## 7. Security and Privacy

- Secure storage of user data
- Transparent handling of API interactions
- Optional anonymized usage statistics
- No collection of personally identifiable information
- Clear data management options (export/delete)
- Optional fully offline operation with no data leaving the user's device

## 8. Configuration and Model Options

- **Configuration System**: Easy-to-edit settings file with CLI interface for modifications
- **Model Selection**:
  - Local Ollama models with automatic discovery of available models
  - Claude Haiku and other Anthropic models
  - OpenAI models (ChatGPT, etc.)
  - Other API-based models
- **Model Settings**: Adjustable parameters for temperature, context length, etc.
- **API Key Management**: Secure storage of API keys for cloud-based models
- **Offline Mode**: Full functionality with local models when internet is unavailable

## 9. Future Enhancements (Post-MVP)

- Community-contributed content and courses
- Audio pronunciation (text-to-speech integration)
- Speech recognition for pronunciation practice
- Expanded offline capabilities
- Sync across devices
- Customizable learning paths

## 10. Success Metrics

- User retention (daily active users)
- Average session duration
- Word learning rate
- Activity completion rate
- User-reported satisfaction
- Number of languages actively learned per user

## 11. Implementation Timeline

### Phase 1: MVP (4 weeks)
- Basic CLI interface
- Language selection
- Configuration system with model selection
- Ollama integration for local models
- Flashcard and fill-in-blank activities
- Simple chat functionality
- Basic progress tracking

### Phase 2: Enhancement (4 weeks)
- Additional learning activities
- Improved chat with adjustable levels
- Enhanced progress visualization
- Achievement system
- Course structure implementation

### Phase 3: Refinement (2 weeks)
- Performance optimization
- User experience improvements
- Bug fixes and edge case handling
- Documentation completion

## 12. Appendix

### Supported Languages (Initial)
- Spanish
- French
- German
- Italian
- Portuguese
- Japanese
- Chinese (Mandarin)
- Russian
- Arabic
- Korean
- (Additional languages based on Claude Haiku capabilities)
