#include <iostream>
#include <vector>
#include <queue>
#include <algorithm>
#include <iomanip>
#include <string>
#include <limits>
#include <map>

using namespace std;

struct ProcIn {
    int pid;
    int arrival;
    int burst;
    int priority; // lower number = higher priority (common convention)
};

struct Segment {
    int start, end;      // [start, end)
    int pid;            // -1 = idle
};

struct ProcOut {
    int pid, arrival, burst, priority;
    int completion = 0;
    int turnaround = 0;
    int waiting = 0;
};

struct RunStats {
    vector<ProcOut> table;
    vector<Segment> gantt;
    double avgWT = 0.0, avgTAT = 0.0;
    double throughput = 0.0;       // processes per unit time
    double cpuUtil = 0.0;          // %
    int totalTime = 0;             // makespan
    int totalIdle = 0;
    string name;
};

static void printLine(int n=60, char c='-'){ for(int i=0;i<n;i++) cout<<c; cout<<"\n"; }

static void printGantt(const vector<Segment>& seg) {
    if (seg.empty()) { cout << "(empty)\n"; return; }
    // Top bar
    cout << "Gantt: \n";
    printLine(80,'=');
    for (auto &s : seg) {
        int w = max(1, s.end - s.start);
        cout << "|";
        int inside = max(1, w-1);
        string lbl = (s.pid == -1 ? "IDLE" : ("P" + to_string(s.pid)));
        if ((int)lbl.size() > inside) lbl = lbl.substr(0, inside);
        int leftPad = (inside - (int)lbl.size())/2;
        int rightPad = inside - leftPad - (int)lbl.size();
        for (int i=0;i<leftPad;i++) cout << " ";
        cout << lbl;
        for (int i=0;i<rightPad;i++) cout << " ";
    }
    cout << "|\n";
    // Bottom time marks
    int last = -1;
    for (auto &s : seg) {
        cout << s.start;
        int w = max(1, s.end - s.start);
        string spaces(w, ' ');
        // align so the next number appears under the next separator
        if (last != s.end) cout << string(max(1, w), ' ');
        last = s.end;
    }
    cout << last << "\n";
    printLine(80,'=');
}

static void printIdleChart(const vector<Segment>& seg) {
    cout << "CPU Idle segments: ";
    bool any=false;
    for (auto &s : seg) {
        if (s.pid == -1) {
            cout << "[" << s.start << "," << s.end << ") ";
            any=true;
        }
    }
    if(!any) cout << "None";
    cout << "\n";
}

static void printTable(const vector<ProcOut>& T) {
    cout << left
         << setw(6)  << "PID"
         << setw(8)  << "AT"
         << setw(8)  << "BT"
         << setw(10) << "PRIOR"
         << setw(10) << "CT"
         << setw(10) << "TAT"
         << setw(10) << "WT" << "\n";
    printLine(62);
    for (auto &p : T) {
        cout << left
             << setw(6)  << p.pid
             << setw(8)  << p.arrival
             << setw(8)  << p.burst
             << setw(10) << p.priority
             << setw(10) << p.completion
             << setw(10) << p.turnaround
             << setw(10) << p.waiting << "\n";
    }
}

static void finalizeMetrics(RunStats& rs) {
    int n = (int)rs.table.size();
    double sumWT=0, sumTAT=0;
    for (auto &p : rs.table) { sumWT += p.waiting; sumTAT += p.turnaround; }
    rs.avgWT = (n? sumWT/n : 0);
    rs.avgTAT = (n? sumTAT/n : 0);

    rs.totalTime = 0;
    if (!rs.gantt.empty()) rs.totalTime = rs.gantt.back().end - rs.gantt.front().start;
    rs.totalIdle = 0;
    for (auto &s : rs.gantt) if (s.pid == -1) rs.totalIdle += (s.end - s.start);

    int finished = n;
    rs.throughput = (rs.totalTime>0? (double)finished/rs.totalTime : 0.0);
    int busy = rs.totalTime - rs.totalIdle;
    rs.cpuUtil = (rs.totalTime>0? 100.0 * busy / rs.totalTime : 0.0);
}

//////////////////////////////////////////////////////////////////////////
// Generic helpers

struct Live {
    int idx;            // index into original array
    int remaining;
    int priority;
    int arrival;
};

static RunStats simulateFCFS(const vector<ProcIn>& in) {
    RunStats rs; rs.name = "FCFS";
    int n = (int)in.size();
    vector<ProcOut> out(n);
    vector<ProcIn> p = in;
    sort(p.begin(), p.end(), [](auto &a, auto &b){
        if (a.arrival != b.arrival) return a.arrival < b.arrival;
        return a.pid < b.pid;
    });

    int t = 0;
    int done = 0;
    auto addSeg = [&](int st, int en, int pid) {
        if (st==en) return;
        if (!rs.gantt.empty() && rs.gantt.back().pid == pid && rs.gantt.back().end == st) {
            rs.gantt.back().end = en;
        } else {
            rs.gantt.push_back({st,en,pid});
        }
    };

    for (auto &pr : p) {
        if (t < pr.arrival) { addSeg(t, pr.arrival, -1); t = pr.arrival; }
        int st = t; t += pr.burst;
        addSeg(st, t, pr.pid);

        ProcOut po;
        po.pid=pr.pid; po.arrival=pr.arrival; po.burst=pr.burst; po.priority=pr.priority;
        po.completion=t;
        po.turnaround=po.completion - po.arrival;
        po.waiting=po.turnaround - po.burst;
        out[pr.pid-1]=po;
        done++;
    }
    rs.table = out;
    finalizeMetrics(rs);
    return rs;
}

static RunStats simulateSJF(const vector<ProcIn>& in, bool preemptive=false) {
    RunStats rs; rs.name = preemptive? "SRTF (Preemptive SJF)" : "SJF (Non-preemptive)";
    int n = (int)in.size();
    vector<ProcOut> out(n);
    vector<int> remaining(n);
    vector<bool> finished(n,false);

    for (auto &p: in) remaining[p.pid-1] = p.burst;

    int t = 0, completed = 0;
    auto allArrived = [&](int time) {
        int mn = INT_MAX, pick=-1;
        for (auto &p : in) {
            int id = p.pid-1;
            if (!finished[id] && p.arrival <= time && remaining[id] > 0) {
                if (remaining[id] < mn) {
                    mn = remaining[id]; pick = p.pid;
                } else if (remaining[id] == mn && p.arrival < in[pick-1].arrival) {
                    pick = p.pid;
                }
            }
        }
        return pick; // pid or -1
    };

    auto addSeg = [&](int st, int en, int pid) {
        if (st==en) return;
        if (!rs.gantt.empty() && rs.gantt.back().pid == pid && rs.gantt.back().end == st)
            rs.gantt.back().end = en;
        else rs.gantt.push_back({st,en,pid});
    };

    int lastPID = -2;
    while (completed < n) {
        int pid = allArrived(t);
        if (pid==-1) {
            int nextArrival = INT_MAX;
            for (auto &p: in) if (!finished[p.pid-1]) nextArrival = min(nextArrival, p.arrival);
            int jump = (nextArrival==INT_MAX? t+1 : max(t+1, nextArrival));
            addSeg(t, jump, -1);
            t = jump;
            continue;
        }
        int id = pid-1;
        if (!preemptive) {
            // run to completion
            int st = t;
            t += remaining[id];
            remaining[id] = 0;
            addSeg(st, t, pid);
            finished[id] = true;
            out[id] = {pid, in[id].arrival, in[id].burst, in[id].priority, t, t - in[id].arrival, (t - in[id].arrival - in[id].burst)};
            completed++;
        } else {
            // preemptive: run 1 unit
            int st = t;
            t += 1;
            remaining[id]--;
            addSeg(st, t, pid);
            if (remaining[id]==0) {
                finished[id] = true; completed++;
                out[id] = {pid, in[id].arrival, in[id].burst, in[id].priority, t, t - in[id].arrival, (t - in[id].arrival - in[id].burst)};
            }
        }
    }

    rs.table = out;
    finalizeMetrics(rs);
    return rs;
}

static RunStats simulatePriorityPreemptive(const vector<ProcIn>& in, int agingInterval=5) {
    // lower priority number => higher priority
    RunStats rs; rs.name = "Priority (Preemptive) + Aging";
    int n = (int)in.size();
    vector<ProcOut> out(n);
    vector<int> remaining(n);
    vector<bool> finished(n,false);
    vector<int> dynPriority(n);
    vector<int> lastAged(n,0);      // last time priority was aged (for each proc) when ready
    vector<bool> readyFlag(n,false);

    for (auto &p: in) { remaining[p.pid-1] = p.burst; dynPriority[p.pid-1]=p.priority; }

    auto pick = [&](int time)->int {
        int best=-1, bestPr=INT_MAX, bestArr=INT_MAX;
        for (auto &p: in) {
            int id=p.pid-1;
            if (!finished[id] && p.arrival<=time && remaining[id]>0) {
                if (dynPriority[id] < bestPr) { bestPr=dynPriority[id]; best=p.pid; bestArr=p.arrival; }
                else if (dynPriority[id]==bestPr && p.arrival<bestArr) { best=p.pid; bestArr=p.arrival; }
            }
        }
        return best; // pid or -1
    };

    auto addSeg = [&](int st, int en, int pid) {
        if (st==en) return;
        if (!rs.gantt.empty() && rs.gantt.back().pid == pid && rs.gantt.back().end == st)
            rs.gantt.back().end = en;
        else rs.gantt.push_back({st,en,pid});
    };

    int t=0, completed=0;

    while (completed<n) {
        // Aging: for all ready (arrived, not finished) procs that are NOT running this tick,
        // every 'agingInterval' time units of waiting, improve priority by 1 (i.e., decrement number).
        for (auto &p: in) {
            int id=p.pid-1;
            bool ready = (!finished[id] && p.arrival<=t && remaining[id]>0);
            if (ready) {
                // If just became ready, align lastAged
                if (!readyFlag[id]) { lastAged[id]=t; readyFlag[id]=true; }
            } else {
                readyFlag[id]=false;
            }
        }

        int pid = pick(t);
        if (pid==-1) {
            int nextArrival = INT_MAX;
            for (auto &p: in) if (!finished[p.pid-1]) nextArrival = min(nextArrival, p.arrival);
            int jump = (nextArrival==INT_MAX? t+1 : max(t+1, nextArrival));
            addSeg(t, jump, -1);
            // advance t with aging applied over idle span
            for (auto &p: in) {
                int id=p.pid-1;
                if (!finished[id] && p.arrival<=t && remaining[id]>0) {
                    // will address after updating t below
                }
            }
            t = jump;
            continue;
        }

        // Apply aging for others over 1 time unit
        for (auto &p: in) {
            int id=p.pid-1;
            if (!finished[id] && p.arrival<=t && remaining[id]>0 && p.pid!=pid) {
                if ((t - lastAged[id] + 1) >= agingInterval) {
                    dynPriority[id] = max(0, dynPriority[id]-1);
                    lastAged[id] = t+1;
                }
            }
        }

        int id = pid-1;
        int st=t; t+=1;
        remaining[id]--;
        addSeg(st,t,pid);
        if (remaining[id]==0) {
            finished[id]=true; completed++;
            out[id] = {pid, in[id].arrival, in[id].burst, in[id].priority, t, t - in[id].arrival, (t - in[id].arrival - in[id].burst)};
        }
    }

    rs.table = out;
    finalizeMetrics(rs);
    return rs;
}

static RunStats simulateRoundRobin(const vector<ProcIn>& in, int quantum) {
    RunStats rs; rs.name = "Round Robin (q="+to_string(quantum)+")";
    int n = (int)in.size();
    vector<ProcOut> out(n);
    vector<int> remaining(n);
    for (auto &p: in) remaining[p.pid-1]=p.burst;

    auto cmpArrival = [](const ProcIn& a, const ProcIn& b){
        if (a.arrival != b.arrival) return a.arrival < b.arrival;
        return a.pid < b.pid;
    };
    vector<ProcIn> byArrival = in;
    sort(byArrival.begin(), byArrival.end(), cmpArrival);

    queue<int> rq; // store pid
    int t=0, i=0, completed=0;

    auto addSeg = [&](int st, int en, int pid) {
        if (st==en) return;
        if (!rs.gantt.empty() && rs.gantt.back().pid == pid && rs.gantt.back().end == st)
            rs.gantt.back().end = en;
        else rs.gantt.push_back({st,en,pid});
    };

    // bring initial arrivals
    while (i<n && byArrival[i].arrival<=t) { rq.push(byArrival[i].pid); i++; }

    int lastTime = t;
    while (completed<n) {
        if (rq.empty()) {
            // jump to next arrival
            if (i<n) {
                addSeg(t, byArrival[i].arrival, -1);
                t = byArrival[i].arrival;
                while (i<n && byArrival[i].arrival<=t) { rq.push(byArrival[i].pid); i++; }
                continue;
            } else break;
        }

        int pid = rq.front(); rq.pop();
        int id = pid-1;
        int run = min(quantum, remaining[id]);
        int st = t; t += run; remaining[id] -= run;
        addSeg(st, t, pid);

        // enqueue newly arrived during this run
        while (i<n && byArrival[i].arrival<=t) { rq.push(byArrival[i].pid); i++; }

        if (remaining[id] > 0) {
            rq.push(pid); // back of the queue
        } else {
            // finished
            completed++;
            out[id] = {pid, in[id].arrival, in[id].burst, in[id].priority, t, t - in[id].arrival, (t - in[id].arrival - in[id].burst)};
        }
    }

    rs.table = out;
    finalizeMetrics(rs);
    return rs;
}

//////////////////////////////////////////////////////////////////////////
// Input, runner, comparison

static vector<ProcIn> readInput() {
    int n;
    cout << "Enter number of processes: ";
    cin >> n;
    vector<ProcIn> p(n);
    cout << "Enter AT BT Priority for each process (priority: lower = higher):\n";
    for (int i=0;i<n;i++) {
        p[i].pid = i+1;
        cin >> p[i].arrival >> p[i].burst >> p[i].priority;
    }
    return p;
}

static void printSummary(const RunStats& rs) {
    cout << "\n== " << rs.name << " ==\n";
    printTable(rs.table);
    cout << fixed << setprecision(2);
    cout << "\nAverage WT: " << rs.avgWT
         << " | Average TAT: " << rs.avgTAT
         << " | Throughput: " << rs.throughput << " proc/unit"
         << " | CPU Utilization: " << rs.cpuUtil << "%\n";
    cout << "Total time: " << rs.totalTime << " | Idle: " << rs.totalIdle << "\n\n";
    printGantt(rs.gantt);
    printIdleChart(rs.gantt);
}

static void compareAll(const vector<ProcIn>& base, int rrq, int agingInterval) {
    vector<RunStats> all;
    all.push_back(simulateFCFS(base));
    all.push_back(simulateSJF(base,false));
    all.push_back(simulateSJF(base,true));
    all.push_back(simulatePriorityPreemptive(base,agingInterval));
    all.push_back(simulateRoundRobin(base, rrq));

    cout << "\n==================== COMPARISON ====================\n";
    cout << left
         << setw(28) << "Algorithm"
         << setw(12) << "Avg WT"
         << setw(12) << "Avg TAT"
         << setw(14) << "Throughput"
         << setw(16) << "CPU Util (%)"
         << setw(12) << "Idle Time"
         << "\n";
    printLine(94);
    cout << fixed << setprecision(2);
    for (auto &rs : all) {
        cout << left
             << setw(28) << rs.name
             << setw(12) << rs.avgWT
             << setw(12) << rs.avgTAT
             << setw(14) << rs.throughput
             << setw(16) << rs.cpuUtil
             << setw(12) << rs.totalIdle
             << "\n";
    }
    cout << "====================================================\n\n";

    // Optional: also show idle charts quickly
    for (auto &rs : all) {
        cout << rs.name << " -> ";
        printIdleChart(rs.gantt);
    }
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    cout << "CPU Scheduling (C++)\n";
    printLine();

    vector<ProcIn> base = readInput();

    while (true) {
        cout << "\nChoose Algorithm:\n";
        cout << "1) FCFS\n";
        cout << "2) SJF (Non-preemptive)\n";
        cout << "3) SRTF (Preemptive SJF)\n";
        cout << "4) Priority (Preemptive) with Aging\n";
        cout << "5) Round Robin\n";
        cout << "6) Compare All (FCFS, SJF, SRTF, Priority+Age, RR)\n";
        cout << "0) Exit\n";
        cout << "Enter choice: ";
        int ch; cin >> ch;
        if (ch==0) break;

        if (ch==1) {
            auto rs = simulateFCFS(base);
            printSummary(rs);
        } else if (ch==2) {
            auto rs = simulateSJF(base,false);
            printSummary(rs);
        } else if (ch==3) {
            auto rs = simulateSJF(base,true);
            printSummary(rs);
        } else if (ch==4) {
            int ageInt=5;
            cout << "Enter aging interval (time units, default 5): ";
            if (cin.peek()=='\n') cin.ignore();
            if(!(cin>>ageInt)) { cin.clear(); cin.ignore(numeric_limits<streamsize>::max(),'\n'); ageInt=5; }
            auto rs = simulatePriorityPreemptive(base, ageInt);
            printSummary(rs);
        } else if (ch==5) {
            int q;
            cout << "Enter time quantum: ";
            cin >> q;
            auto rs = simulateRoundRobin(base,q);
            printSummary(rs);
        } else if (ch==6) {
            int q=3, ageInt=5;
            cout << "Enter RR quantum (default 3): ";
            if(!(cin>>q)) { cin.clear(); cin.ignore(numeric_limits<streamsize>::max(),'\n'); q=3; }
            cout << "Enter Priority aging interval (default 5): ";
            if(!(cin>>ageInt)) { cin.clear(); cin.ignore(numeric_limits<streamsize>::max(),'\n'); ageInt=5; }
            compareAll(base,q,ageInt);
        } else {
            cout << "Invalid choice.\n";
        }
    }
    return 0;
}
