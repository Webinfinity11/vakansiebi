import { UiText } from '@/app/ui-language';
import { WorkspacePreviewScene } from './workspace-preview-scene';
import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  Inbox,
  MessageSquareText,
  MousePointer2,
  Plus,
  Users,
} from 'lucide-react';

/* The company workspace as it really looks: navy sidebar, stage lanes with their
   shape marks and colours. Illustrative candidates only; no real applicant data. */
type Candidate = { initials: string; role: string; meta: string; tone: number };
const columns: {
  stage: 'new' | 'interview' | 'offer';
  Icon: typeof Plus;
  label: string;
  cards: Candidate[];
}[] = [
  {
    stage: 'new',
    Icon: Plus,
    label: 'ახალი',
    cards: [
      { initials: 'ნ.გ.', role: 'მიმტანი', meta: '1 სთ წინ', tone: 1 },
      { initials: 'ლ.ც.', role: 'მოლარე', meta: '3 სთ წინ', tone: 2 },
    ],
  },
  {
    stage: 'interview',
    Icon: MessageSquareText,
    label: 'გასაუბრებაზე',
    cards: [
      { initials: 'დ.ხ.', role: 'ბუღალტერი', meta: '★ 4', tone: 0 },
      { initials: 'ე.ქ.', role: 'მძღოლი', meta: '★ 5', tone: 2 },
    ],
  },
  {
    stage: 'offer',
    Icon: BriefcaseBusiness,
    label: 'შეთავაზებული',
    cards: [{ initials: 'ს.ა.', role: 'ოპერატორი', meta: '★ 5', tone: 1 }],
  },
];
const incoming: Candidate = { initials: 'ა.ბ.', role: 'ბარისტა', meta: 'ახლახან', tone: 0 };
const sections = [
  { Icon: BriefcaseBusiness, label: 'ვაკანსიები', count: 4 },
  { Icon: Inbox, label: 'კანდიდატები', current: true },
  { Icon: FileText, label: 'CV ბაზა' },
  { Icon: BarChart3, label: 'ანალიტიკა' },
  { Icon: Users, label: 'გუნდი' },
];

function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <>
      <span className="bw-card-top">
        <span className="bw-avatar" data-tone={candidate.tone}>
          <UiText>{candidate.initials}</UiText>
        </span>
        <small className="bw-meta">
          <UiText>{candidate.meta}</UiText>
        </small>
      </span>
      <strong className="bw-candidate">
        <UiText>{candidate.role}</UiText>
      </strong>
    </>
  );
}

export function WorkspacePreview() {
  return (
    <WorkspacePreviewScene>
      <div className="bw-window">
        <div className="bw-chrome">
          <span />
          <span />
          <span />
          <em>jobx.ge/company</em>
        </div>
        <div className="bw-body">
          <div className="bw-side">
            <span className="bw-company">
              <b>
                <UiText>კ</UiText>
              </b>
              <span>
                <strong>
                  <UiText>თქვენი კომპანია</UiText>
                </strong>
              </span>
            </span>
            <ul>
              {sections.map(({ Icon, label, current, count }) => (
                <li key={label} data-current={current || undefined}>
                  <Icon size={14} />
                  <UiText>{label}</UiText>
                  {count && <em>{count}</em>}
                </li>
              ))}
            </ul>
          </div>
          <div className="bw-main">
            <div className="bw-title">
              <strong>
                <UiText>კანდიდატები</UiText>
              </strong>
              <span className="bw-example">
                <UiText>საილუსტრაციო მაგალითი</UiText>
              </span>
            </div>
            <div className="bw-board">
              {columns.map(({ stage, Icon, label, cards }) => (
                <div key={stage} className="bw-col" data-stage={stage}>
                  <span className="bw-col-head">
                    <Icon size={12} strokeWidth={2} />
                    <UiText>{label}</UiText>
                    <b className={`bw-count bw-count--${stage}`}>
                      <span className="bw-count-base">{cards.length}</span>
                      {stage !== 'offer' && (
                        <span className="bw-count-next">{cards.length + 1}</span>
                      )}
                    </b>
                  </span>
                  <div className="bw-stack">
                    {cards.map((candidate) => (
                      <span key={candidate.initials} className="bw-card">
                        <CandidateCard candidate={candidate} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="bw-transfer">
                <span className="bw-card bw-card--incoming">
                  <CandidateCard candidate={incoming} />
                </span>
                <span className="bw-cursor">
                  <MousePointer2 size={23} fill="currentColor" />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bw-toast">
          <Inbox size={14} />
          <UiText>ახალი განაცხადი</UiText>
        </div>
      </div>
      <div className="bw-float bw-float--stats">
        <span className="bw-float-label">
          <UiText>ნახვები და განაცხადები</UiText>
        </span>
        <span className="bw-bars">
          {[38, 52, 46, 70, 64, 88, 76, 96].map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </span>
        <span className="bw-stat-copy">
          <span className="bw-stat-base">
            <UiText>+11 განაცხადი ამ კვირაში</UiText>
          </span>
          <span className="bw-stat-next">
            <UiText>+12 განაცხადი ამ კვირაში</UiText>
          </span>
        </span>
      </div>
    </WorkspacePreviewScene>
  );
}
