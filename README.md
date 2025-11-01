
- **Better Auth**: Seamless and secure authentication.
- **Drizzle ORM**: Elegant and type-safe database management.

# 🧠 Adaptive Computer Network Learning Platform  

## 📘 Overview  
A fine-tuned AI-powered platform for **Computer Networks** that adapts learning content to each student’s level.  
The system automatically generates educational materials, multiple-choice and short-answer questions, and real-time feedback — all stored in **Supabase** and powered by a **locally served AI model** via **Ollama**.  

Students experience a personalized learning path from pre-test to post-test, while instructors manage and analyze results through a clean dashboard.  

---

## 🏗️ Tech Stack  

### Frontend  
- **Next.js 16 (App Router)**  
- **Tailwind CSS**  
- **shadcn/ui**

### Backend  
- **Next.js API Routes**  
- **Supabase (PostgreSQL)** for data and user management  
- **Ollama** (`http://localhost:11434/api/generate`) for AI inference  

### AI Model  
- **tinyllama(fine-tuned)**  
- Generates module content, questions (MCQ + short-answer), and adaptive feedback  

---

## 🚀 Core Features  

### 👨‍🏫 Instructor Workflow  

1. **Module Upload**  
   - Upload any networking topic (text/.txt).  
   - AI automatically generates:  
     - Learning materials for *Easy*, *Medium*, *High* levels.  
     - 5 MCQ and 5 short-answer questions per level.  
     - Correct answers, explanations, and difficulty tags.  

2. **Content Storage**  
   - All AI-generated data saved in Supabase:  
     - `module_contents` → per-level materials  
     - `items` → MCQ + short-answer questions  
   - Reusable for all students.  

3. **Instructor Dashboard**  
   - Monitor student progress, test results, and overall trends.  

---

### 🧑‍🎓 Student Learning Flow  

1. **Select a Module**  
   - Choose from AI-generated modules.  

2. **Pre-Test**  
   - 30 questions determine the student’s level (*Easy*, *Medium*, *High*).  

3. **Adaptive Lesson**  
   - System serves level-specific learning content from Supabase.  

4. **Practice Phase**  
   - AI-generated mix of MCQ and short-answer questions.  
   - Real-time AI feedback using Ollama inference.  

5. **Post-Test and Summary**  
   - Post-test evaluates mastery.  
   - AI summarizes performance, strengths, and weaknesses.  

---

## 🧠 AI Integration  

- **All generation runs locally** via Ollama for privacy and low latency.  
- **No RAG:** All learning content is generated and stored from uploaded modules.  
- **Prompt Engineering:** The model creates per-level materials, question sets, and explanations.  
- **Feedback Loop:** AI evaluates every student answer and produces both per-question and overall feedback.  

---

## 🗄️ Database Schema  

### Core Tables  

| Table | Description |
|--------|--------------|
| `profiles` | User info and roles |
| `modules` | Instructor uploads |
| `module_contents` | AI-generated per-level materials |
| `items` | Questions (MCQ + short answer) |
| `attempts` | Student responses and feedback |
| `placements` | Student level tracking |

### Example Definitions  

```sql
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.profiles(id),
  title text not null,
  description text,
  created_at timestamp default now()
);

create table public.module_contents (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  level text check (level in ('easy','medium','high')),
  content text not null,
  created_at timestamp default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  level text check (level in ('easy','medium','high')),
  type text check (type in ('pretest','practice','posttest')),
  question_type text check (question_type in ('mcq','short')),
  question text not null,
  options jsonb,
  answer text,
  explanation text,
  created_at timestamp default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  item_id uuid references public.items(id),
  selected_answer text,
  ai_feedback text,
  is_correct boolean,
  created_at timestamp default now()
);

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  module_id uuid references public.modules(id),
  level text check (level in ('easy','medium','high')),
  score numeric,
  updated_at timestamp default now()
);
```

---

## 🔁 Adaptive Learning Flow  

| Phase | Description | AI Role | Output |
|-------|--------------|----------|--------|
| Module Upload | Instructor uploads content | Generate per-level material & questions | `module_contents`, `items` |
| Pre-Test | Student starts module | Evaluate level | `placements` |
| Lesson | Student studies content | Provide summaries | `module_contents` |
| Practice | Student answers MCQ + short | Real-time feedback | `attempts` |
| Post-Test | Student finishes | Evaluate mastery | `attempts` |
| Summary | AI evaluates total performance | Feedback report | dashboard view |

---

## 🧩 Example AI Prompt  

```js
const response = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "tinyllama",
    prompt: `
      For the uploaded module about "IPv4 Subnetting",
      generate:
      1. Easy, Medium, and High level learning summaries.
      2. 5 multiple-choice and 5 short-answer questions per level.
      Format each item as JSON with keys:
      { "level": "...", "question_type": "...", "question": "...", "options": [...], "answer": "...", "explanation": "..." }
    `,
  }),
});
```