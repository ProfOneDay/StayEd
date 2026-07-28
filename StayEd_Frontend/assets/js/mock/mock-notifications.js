
MockDB.notifications = [
    {
        id: 1, category: "alert", read: false,
        title: "New High Risk Alert", text: "Juan Santos has been flagged as High Risk (82% probability).",
        time: "10 minutes ago", learnerId: 1
    },
    {
        id: 2, category: "intervention", read: false,
        title: "Intervention Follow-up Due", text: "Scheduled consultation for Ana Batungbakal is due tomorrow.",
        time: "1 hour ago", learnerId: 6
    },
    {
        id: 3, category: "registration", read: false,
        title: "New Learner Registered", text: "Elena Torres has been enrolled under Basic Literacy Program.",
        time: "3 hours ago", learnerId: 4
    },
    {
        id: 4, category: "system", read: true,
        title: "Predictions Refreshed", text: "The predictive model has finished analyzing this trimester's data.",
        time: "Yesterday"
    },
    {
        id: 5, category: "alert", read: true,
        title: "Risk Level Changed", text: "Isabel Ramos moved from Moderate to High Risk.",
        time: "Yesterday", learnerId: 10
    },
    {
        id: 6, category: "system", read: true,
        title: "Scheduled Maintenance", text: "StayEd will undergo maintenance this Sunday from 12AM-2AM.",
        time: "2 days ago"
    },
    {
        id: 7, category: "intervention", read: true,
        title: "Intervention Marked Resolved", text: "The counseling session for Ricardo Dalisay was completed successfully.",
        time: "3 days ago", learnerId: 3
    },
    {
        id: 8, category: "registration", read: true,
        title: "Batch Import Completed", text: "42 learner records were imported for San Felipe Sur CLC.",
        time: "5 days ago"
    }
];
