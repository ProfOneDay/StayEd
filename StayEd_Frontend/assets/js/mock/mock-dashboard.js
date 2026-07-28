
MockDB.dashboard = {

    context: {
        registered_learners: 42,
        selected_class: "Basic Literacy Program, San Felipe Sur CLC",
        school_year: "2026-2027",
        trimester: "First Trimester",
        last_updated: "July 8, 2026",
        greeting_name: "Trisha"
    },

    statistics: {
        registered: 42,
        high: 8,
        moderate: 11,
        low: 23,
        high_delta: 2,
        moderate_trend: "Stable",
        low_trend: "Stable"
    }

};

MockDB.predictionSummary = {
    date: "July 8, 2026",
    coverage: "100%",
    model: "v1",
    confidence: "High",
    algorithm: "Logistic Regression",
    insights: [
        { tone: "primary", text: "Most learners are currently classified as Low Risk" },
        { tone: "error", text: "Three learners recently moved from Moderate to High Risk" }
    ]
};

MockDB.riskDistribution = {
    high: 8,
    moderate: 11,
    low: 23,
    scale_max: 25
};

MockDB.interventions = [
    {
        id: 1, prediction_id: 1, learner: "Juan Santos",
        recommended_action: "Schedule home visit and attendance counseling",
        status: "Pending", teacher_feedback: null
    },
    {
        id: 2, prediction_id: 6, learner: "Ana Batungbakal",
        recommended_action: "Assign remedial modules and weekly check-in",
        status: "Pending", teacher_feedback: null
    },
    {
        id: 3, prediction_id: 10, learner: "Isabel Ramos",
        recommended_action: "Refer to guidance and provide learning materials",
        status: "In Progress", teacher_feedback: "Contacted guardian"
    }
];
