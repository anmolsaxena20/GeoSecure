# GeoSecure

A comprehensive platform combining geospatial analysis, AI-driven insights, and secure backend infrastructure for risk assessment, market analysis, and supply chain optimization.

## Project Architecture

GeoSecure is structured as a modular full-stack application with the following components:

### 📡 **ai/** - LLM & Agentic AI Layer

Centralized AI and machine learning components including:

- **Agents**: Multi-role agent orchestration (supply chain, market analysis, research, review)
- **Configs**: LLM model configuration and tool definitions
- **Services**: External API integrations (AlphaVantage, Guardian, GDELT, World Bank)
- **Memory**: Long-term and short-term memory management for agents
- **Prompts**: Reusable prompt templates and system instructions
- **Workflows**: Multi-step orchestration pipelines (RAG, multi-agent loops)
- **Controllers**: Market, news, and report controllers
- **Database**: Event, article, and persistence layers

### 🔧 **backend/** - Node.js/Express Backend

RESTful API and business logic:

- **Authentication**: Passport.js configuration with multiple strategies
- **Database**: Prisma ORM with migrations for user models and data persistence
- **Controllers**: Auth and user management
- **Services**: Core business logic integration and HTTP-based AI calls

### 💻 **frontend/** - React + Vite UI

Modern, responsive user interface:

- **Vite**: Fast development server and build tool
- **Tailwind CSS**: Utility-first styling
- **Components**: Login, Signup, Home pages
- **Assets**: Images and static resources

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL (for backend database)
- Redis (optional, for caching)

### Setup Instructions

1. **Backend Setup**

   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   npm start
   ```

2. **AI Module Setup**

   ```bash
   cd ai
   npm install
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Environment Configuration

Ensure `.env` files are configured in each module:

- `backend/.env` - Database, Redis, API credentials
- `ai/.env` - LLM API keys, service credentials
- `frontend/.env` - API endpoints

## Key Features

- 🤖 **Multi-Agent Orchestration**: Coordinated AI agents for specialized tasks
- 📊 **Market Analysis**: Real-time market data aggregation and insights
- 🔐 **Secure Authentication**: JWT-based auth with multiple strategies
- 💾 **Persistent Storage**: PostgreSQL backend with Prisma ORM
- 🔄 **gRPC Communication**: Efficient inter-service communication
- 🧠 **Knowledge Management**: RAG pipeline for contextual AI responses
- 📈 **Risk Assessment**: Supply chain and market risk evaluation

## Project Structure

```
GeoSecure/
├── ai/                      # LLM & Agent layer
│   ├── agents/             # Role-based agents
│   ├── services/           # External integrations
│   ├── configs/            # Model & tool configs
│   ├── prompts/            # Prompt templates
│   ├── memory/             # Agent memory stores
│   ├── workflows/          # Orchestration blueprints
│   └── package.json
├── backend/                 # Node.js API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── config/        # Service configs
│   │   ├── routes/        # API routes
│   │   └── utils/         # Utilities
│   ├── prisma/            # Database schema
│   └── package.json
├── frontend/               # React UI
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── assets/        # Static files
│   │   └── config/        # Frontend config
│   └── package.json
```

## Documentation

- [AI Module](./ai/README.md) - Detailed AI/Agent documentation
- [Authentication Setup](./AUTHENTICATION_SETUP.md) - Auth configuration guide
- [Verification](./verify_setup.sh) - Setup verification script

## API Documentation

The backend exposes REST endpoints for:

- User authentication and management
- Market data queries
- Report generation
- News and event streaming

## Technologies

- **Backend**: Node.js, Express, Prisma, PostgreSQL
- **Frontend**: React, Vite, Tailwind CSS
- **AI**: LLM integration, Agent orchestration
- **Communication**: REST APIs
- **DevOps**: Docker-ready structure

## Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit changes (`git commit -m 'Add AmazingFeature'`)
3. Push to branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## License

[Add your license here]

## Support

For questions or issues:

- Check existing documentation in module READMEs
- Review the authentication setup guide
- Run the verification script for troubleshooting
