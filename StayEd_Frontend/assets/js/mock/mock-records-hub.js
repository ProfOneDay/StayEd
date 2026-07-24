/**
 * ============================================
 * StayEd
 * Mock Learner Records Hub Data
 * ============================================
 *
 * Modality-specific detail (module progress,
 * attendance sessions, contact status) layered
 * on top of MockDB.learners, keyed by learner id.
 * A sensible default covers any learner without
 * bespoke detail, so every row in the hub renders
 * correctly regardless of dataset size.
 * ============================================
 */

MockDB.recordsHub = {

    _default: {

        modules: {
            total: 8, completed: 5, active: 3,
            contactStatus: "Contacted"
        },

        attendance: {
            totalSessions: 12, attended: 8,
            lastSession: { date: "Jul 25, 2026", status: "Attended" },
            nextSession: { date: "Aug 1, 2026", status: "Scheduled" },
            missed: 2, excused: 2
        },

        lastInteraction: "Today",

        moduleGroups: [
            {
                strand: "LS1 – Communication Skills", icon: "forum",
                modules: [
                    {
                        title: "Module 2: Elements of Short Story",
                        released: "July 10, 2026", due: "July 17, 2026",
                        status: "not_returned", overdueDays: 3,
                        remarks: "Requires extra reading materials."
                    },
                    {
                        title: "Module 3: Business Letter Writing",
                        released: "July 24, 2026", due: "July 31, 2026",
                        status: "in_progress", overdueDays: 0,
                        remarks: ""
                    }
                ]
            },
            {
                strand: "LS3 – Mathematical Skills", icon: "calculate",
                modules: [
                    {
                        title: "Module 5: Ratio and Proportion",
                        released: "July 15, 2026", due: "July 22, 2026",
                        status: "returned", overdueDays: 0,
                        remarks: "Good progress, understands core concepts."
                    }
                ]
            }
        ],

        moduleHistory: [
            { module: "Module 1: Reading Comprehension", strand: "LS1", completedDate: "June 20, 2026", score: "88/100" },
            { module: "Module 4: Basic Algebra", strand: "LS3", completedDate: "July 5, 2026", score: "76/100" }
        ]

    }

};

MockDB.getRecordsHubDetail = function (id) {

    return this.clone(this.recordsHub[id] || this.recordsHub._default);

};
