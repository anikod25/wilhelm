Wilhelm — Enterprise Knowledge-Base Agent

Wilhelm is a multi-turn enterprise knowledge-base agent combining domain routing, grounded RAG, conversational memory, and on-demand output formatting into a single AI workflow.

🎥 Project Demo: https://youtu.be/u8KGFWQlJhs?si=K15FRniv7xc-O2Kn

Wilhelm answers employee questions by retrieving relevant passages from an internal knowledge base and generating responses grounded in those sources. Each response includes its retrieved sources and a machine-readable "grounded" indicator.

What Wilhelm Does

- Domain Routing — Classifies queries as "hr", "support", or "out_of_scope" before retrieval.
- Grounded RAG — Retrieves relevant document chunks and uses them as context for answer generation.
- Multi-turn Conversations — Maintains server-side session history so follow-up questions retain context.
- Source Attribution — Shows exactly which documents and sections were used to generate an answer.
- Multiple Output Formats — Return responses as plain text, JSON, XML, Excel (".xlsx"), or a ready-to-send email.
- Provider Agnostic — Supports OpenAI, Gemini, or local LLMs through a common adapter layer.
- Local or Cloud Deployment — Can run fully locally using Ollama + Chroma or with cloud providers such as OpenAI/Gemini + Pinecone.

Architecture

USER QUERY → ROUTER → RETRIEVER → ANSWER GENERATOR → FORMAT DISPATCHER

The router determines the domain, the retriever searches the relevant knowledge base, the answer layer generates a grounded response, and the format dispatcher converts that response into the requested output format.

Tech Stack

Frontend

- React
- JavaScript
- Vite

Backend

- Node.js
- Express

AI / RAG

- LLM-based domain routing
- Retrieval-Augmented Generation
- Vector embeddings
- Conversation memory

Supported Providers

- OpenAI
- Google Gemini
- Ollama / Local LLMs
- Pinecone
- Chroma

Output Formats

- Plain Text
- JSON
- XML
- Excel
- Email

Demo Knowledge Base

The project currently includes two synthetic knowledge domains:

- HR Policies
- IT Support

⚠️ Synthetic Demo Data: All HR and IT documents included in this project were created specifically for the hackathon demo. They do not represent real KOHLER policies, procedures, or guidance and should not be treated as authoritative.

Project Repository

The complete source code, setup instructions, architecture, prompts, and synthetic knowledge base are available in the project repository.

🔗 GitHub: YOUR_GITHUB_LINK

Built For

A hackathon project exploring the practical implementation of RAG systems, AI agents, enterprise knowledge retrieval, grounded generation, and provider-independent LLM architectures.

#Wilhelm #RAG #AI #AIAgents #LLM #GenerativeAI #ArtificialIntelligence #MachineLearning #VectorDatabase #OpenAI #Gemini #Ollama #Hackathon