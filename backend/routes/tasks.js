const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Task } = require('../models');

// NEW: Import the Google Gen AI SDK
const { GoogleGenAI } = require('@google/genai');

// --- Gemini API Helpers ---

// Initialize the Gemini client. It will automatically use the 
// GEMINI_API_KEY environment variable.
const ai = new GoogleGenAI({}); 

// Using gemini-2.5-flash for its excellent performance and low cost
const model = 'gemini-2.5-flash'; 

// 1. HELPER FOR SHORT, CLASSIFICATION TAS (Default)
const callGemini = async (prompt, maxTokens = 10) => {
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: maxTokens,
                temperature: 0.1, 
            },
        });
        
        const generatedText = response.text; 

        if (generatedText) {
            // Clean output, preserving dots/numbers for categories
            return generatedText.trim().replace(/[^a-zA-Z0-9.\s]/g, ''); 
        } else {
            console.error('Gemini API call failed: No text generated, possibly due to safety block or empty response.', response);
            return null;
        }

    } catch (err) {
        console.error('Gemini API call failed (Caught Error):', err.message); 
        return null; 
    }
};

// 2. 🚀 NEW HELPER FOR LONG-FORM GENERATION (PROCEDURES)
// This function disables the model's "thinking budget" to ensure the maxTokens 
// are used for the final output text, not internal reasoning.
const callGeminiProcedure = async (prompt, maxTokens = 500) => {
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: maxTokens,
                temperature: 0.2, // Slightly higher temperature for creative list generation
                // 🚨 CRITICAL FIX: Set thinkingBudget to 0 to prevent internal reasoning 
                // from consuming the max_tokens limit.
                thinkingConfig: {
                    thinkingBudget: 0, 
                }
            },
        });
        
        const generatedText = response.text; 

        if (generatedText) {
            // Use the same cleaning regex
            return generatedText.trim().replace(/[^a-zA-Z0-9.\s]/g, ''); 
        } else {
            // Log the full response object for debugging
            console.error('Gemini Procedure call failed: No text generated.', response);
            return null;
        }

    } catch (err) {
        console.error('Gemini API call failed (Caught Error):', err.message); 
        return null; 
    }
};

const categorizeTask = (title, description) => {
    const prompt = `You are a task classifier. Given a task title and description, return a single-word category among: Work, Personal, Errand, Study, Other. Output ONLY the category. Title: "${title}". Description: "${description}"`;
    return callGemini(prompt, 10);
};

const suggestPriority = (title, description) => {
    const prompt = `You are an assistant that suggests task priority. Output one of: Low, Medium, High. Consider deadlines, effort, and business impact. Output ONLY the word. Title: "${title}". Description: "${description}"`;
    return callGemini(prompt, 10);
};

// 💡 THIS FUNCTION NOW CALLS THE NEW HELPER
const generateProcedure = (title, description) => {
    const prompt = `You are a productivity consultant. Given the task title and description, generate a step-by-step procedure (5-10 detailed steps) to easily and successfully complete this task. Format the output as a numbered list. Title: "${title}". Description: "${description}"`;
    return callGeminiProcedure(prompt, 500); 
};
// --------------------------------------------------------

// CREATE Task (with AI features)
router.post('/', auth, async (req, res) => {
    const { title, description, due_date } = req.body;
    let category = 'Other';
    let priority = 'Medium';

    // Run AI analysis concurrently
    const [aiCategory, aiPriority] = await Promise.all([
        categorizeTask(title, description),
        suggestPriority(title, description)
    ]);
    
    // Use AI results if successful, fallback to default otherwise
    category = aiCategory || category;
    priority = aiPriority || priority;
    
    const task = await Task.create({
        title, description, due_date, category, priority, UserId: req.user.id
    });
    res.json(task);
});

// READ Tasks
router.get('/', auth, async (req, res) => {
    const tasks = await Task.findAll({ 
        where: { UserId: req.user.id },
        order: [['due_date', 'ASC']]
    });
    res.json(tasks);
});

// UPDATE Task
router.put('/:id', auth, async (req, res) => {
    const t = await Task.findByPk(req.params.id);
    if (!t || t.UserId !== req.user.id) return res.sendStatus(404);
    await t.update(req.body);
    res.json(t);
});

// DELETE Task
router.delete('/:id', auth, async (req, res) => {
    const t = await Task.findByPk(req.params.id);
    if (!t || t.UserId !== req.user.id) return res.sendStatus(404);
    await t.destroy();
    res.json({ success: true });
});

// Optional: Deadline Prediction Endpoint
router.post('/:id/predict-time', auth, async (req, res) => {
    const t = await Task.findByPk(req.params.id);
    if (!t || t.UserId !== req.user.id) return res.sendStatus(404);

    const prompt = `Estimate how many hours (a number, optionally with 1 decimal) it would take to complete this task. Provide only a single number. Task title: "${t.title}". Description: "${t.description}"`;
    
    // Use callGemini with maxTokens 20 for the number output
    const estimateString = await callGemini(prompt, 20); 

    const estimate = parseFloat(estimateString);
    if (estimate) {
        await t.update({ estimated_time_hours: estimate });
    }
    res.json({ estimate: estimate || null });
});

//Endpoint for generating step-by-step procedure using AI
router.post('/:id/generate-procedure', auth, async (req, res) => {
    const t = await Task.findByPk(req.params.id);
    if (!t || t.UserId !== req.user.id) return res.sendStatus(404);

    console.log(`Generating procedure for Task ID: ${t.id}`);

    // Call the AI helper function (which now uses callGeminiProcedure)
    const procedure = await generateProcedure(t.title, t.description);

    if (procedure) {
        res.json({ procedure });
    } else {
        res.status(500).json({ error: 'Failed to generate procedure from AI.' });
    }
});

module.exports = router;