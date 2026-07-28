
MockDB.learnerProfiles = {

    _default: {

        riskTrend: [
            { month: "Jun", value: 45 },
            { month: "Jul", value: 52 },
            { month: "Aug", value: 48 },
            { month: "Sep", value: 61 },
            { month: "Oct", value: 74 },
            { month: "Nov", value: 82 }
        ],

        metrics: {
            attendanceRate: 62,
            attendanceDelta: -5,
            modulesCompleted: 22,
            modulesTotal: 27,
            submissionTimeliness: 82,
            consultationsAttended: 4,
            consultationsTotal: 5
        },

        background: {
            civilStatus: "Single",
            employment: "Part-time (Retail)",
            distanceCategory: "Far (>5km)",
            reenrollee: "Yes",
            yearsEnrolled: "2 Years",
            beneficiary4Ps: "Yes"
        },

        recentActivity: [
            { icon: "trending_up", tone: "error", title: "Prediction Updated: High Risk (87%)", sub: "Today, 09:42 AM" },
            { icon: "file-check", tone: "neutral", title: "Module 22 Submitted", sub: "Graded: 85/100", date: "Oct 20, 2026" },
            { icon: "users", tone: "secondary", title: "Home Visit Logged", sub: "Conducted by Teacher Reyes", date: "Oct 18, 2026" },
            { icon: "mail", tone: "neutral", title: "SMS Warning Sent", sub: "Automated attendance alert", date: "Oct 15, 2026" }
        ],

        recommendedActions: [
            { priority: "high", title: "Contact learner", text: "Immediate follow-up regarding recent absences." },
            { priority: "high", title: "Schedule consultation", text: "Academic intervention for submission delays." },
            { priority: "medium", title: "Monitor next module", text: "Track next submission status closely." }
        ],

        monitoringHistory: {
            attendance: [
                { date: "Jul 3", session: "Session 1", status: "Attended" },
                { date: "Jul 10", session: "Session 2", status: "Missed" },
                { date: "Jul 17", session: "Session 3", status: "Attended" }
            ],
            modules: [
                { module: "Module 1", released: "Jul 2", submitted: "Jul 8" },
                { module: "Module 2", released: "Jul 9", submitted: "Jul 18" },
                { module: "Module 3", released: "Jul 16", submitted: "—" }
            ],
            timeline: [
                { type: "attendance", title: "Missed Attendance", text: "Absent without notice — Session 2.", date: "Jul 10, 2026" },
                { type: "module", title: "Late Module Submission", text: "Module 2 submitted 9 days past release.", date: "Jul 18, 2026" },
                { type: "intervention", title: "Home Visit Conducted", text: "Teacher Reyes followed up in person.", date: "Jul 20, 2026" },
                { type: "note", title: "Advisor Note", text: "Learner reports transportation difficulty affecting attendance.", date: "Jul 21, 2026" },
                { type: "attendance", title: "Risk Score Increased", text: "Risk moved from Moderate to High.", date: "Jul 25, 2026" }
            ]
        },

        riskExplanation: {
            probability: 87,
            confidence: "High",
            model: "Random Forest",
            lastPrediction: "Today, 9:42 AM",
            summary: "StayEd predicts that this learner is currently at High Risk because attendance has declined over recent monitoring periods, several module submissions were late, and consultation participation has decreased.",
            previousRisk: "Moderate Risk",
            currentRisk: "High Risk",
            changes: [
                { icon: "trending_down", tone: "error", text: "Attendance decreased over the last two monitoring periods", severity: "Critical" },
                { icon: "slow_motion_video", tone: "moderate", text: "Module completion slowed", severity: "Warning" },
                { icon: "event_busy", tone: "neutral", text: "No consultation recorded during the previous month", severity: "Missed" }
            ],
            contributors: [
                { icon: "event_busy", tone: "error", title: "Low Attendance Consistency", level: "High", text: "Attendance has remained below the expected level." },
                { icon: "history_edu", tone: "moderate", title: "Late Module Submission", level: "Moderate", text: "Modules are frequently submitted after the expected schedule." },
                { icon: "groups", tone: "moderate", title: "Missed Consultations", level: "Moderate", text: "Participation in scheduled academic sessions has declined." },
                { icon: "work", tone: "neutral", title: "Employment Status", level: "Low", text: "Part-time work may be impacting study time availability." }
            ],
            recordsUsed: "Attendance, Modules, Consultations, Interventions"
        },

        interventions: {
            active: {
                title: "Scheduled Consultation",
                priority: "High Priority",
                assigned: "July 18, 2026",
                followUp: "July 25, 2026",
                status: "In Progress"
            },
            history: [
                { date: "July 18, 2026", intervention: "Scheduled Consultation", reason: "Missed attendance", priority: "High", status: "In Progress", outcome: "Pending" },
                { date: "July 5, 2026", intervention: "SMS Follow-up", reason: "Late module submission", priority: "Medium", status: "Completed", outcome: "Learner responded" },
                { date: "June 20, 2026", intervention: "Guardian Contact", reason: "Repeated absence", priority: "High", status: "Completed", outcome: "Attendance improved" }
            ],
            recommended: [
                { priority: "High Priority", rank: 1, title: "Contact the Learner", factor: "Low attendance consistency", text: "Attendance decreased and a recent session was missed. Direct communication is needed to identify barriers.", action: "Call or message the learner" },
                { priority: "High Priority", rank: 2, title: "Schedule a Consultation", factor: "Missed consultation and delayed module submission", text: "Learner may need guidance on current modules and academic goal setting to prevent further delays.", action: "Arrange a short consultation" },
                { priority: "Medium Priority", rank: 3, title: "Monitor Next Module Submission", factor: "Late module submission", text: "Submitted after expected date. Observe if this becomes a pattern in the next delivery cycle.", action: "Set follow-up reminder" }
            ]
        }

    }

};

MockDB.getLearnerProfile = function (id) {

    const learner =
        this.learners.find(l => String(l.id) === String(id));

    if (!learner) {

        return null;

    }

    const detail =
        this.learnerProfiles[id] || this.learnerProfiles._default;

    return this.clone({
        ...learner,
        ...detail
    });

};
