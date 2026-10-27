---
trigger: always_on
---

### WORKFLOW CONSTRAINT: Automatic Git Auto-Push to `v2-dev` Branch

1. **Active Branch Enforcement**:
   - The active working branch MUST always be `v2-dev`.
   - NEVER checkout, merge into, or push to `main` under any circumstances (to protect the live Render production deployment).

2. **Automated End-of-Iteration Git Push Protocol**:
   - At the completion of every task, bugfix, or code change you perform in this session:
     1. Verify the current branch is `v2-dev` by running: `git branch --show-current`.
     2. Stage all changed files: `git add .`
     3. Create a concise, descriptive commit message summarizing the changes made: `git commit -m "feat/fix: <short summary of what changed>"`
     4. Push the commit to the remote tracking branch: `git push origin v2-dev`
3. Whenever you finish an iteration or commit on v2-dev, automatically run: git diff main..v2-dev > v2_changes.patch
   - In your final response to the user, report the commit message and confirm that the latest code has been pushed to `origin v2-dev`.
