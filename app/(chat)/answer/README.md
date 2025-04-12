# Expert Answer System

The Expert Answer system provides a specialized UI for community experts to view and respond to questions from users. It's designed to create a more collaborative environment where experts can provide high-quality, human-reviewed answers to complex questions.

## How It Works

1. Users can ask questions that get routed to both AI and community experts
2. Experts see assigned questions in their dashboard
3. Experts can view the conversation history and provide specific answers
4. The system tracks the status of expert assignments (assigned, working, submitted, accepted, rejected)

## Components

- **ExpertAnswer**: The main container component for the expert view
- **ExpertResponse**: The component that experts use to submit their responses
- **ExpertRequestStatus**: Displays the status of the current expert request

## Flow

1. Expert logs in and is redirected to the answer page for a specific chat ID
2. Expert reviews the conversation history
3. Expert can see if they're assigned to this question
4. Expert can start working and submit a response
5. The response is reviewed and either accepted or rejected

## Security

Only experts assigned to a particular question can access the answer page for that chat. 