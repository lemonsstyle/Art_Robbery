export function DogRunner() {
  return (
    <span className="dog-runner-wrap">
      <span className="dog-bark">汪!</span>
      <svg className="dog-runner" viewBox="0 0 64 48" aria-hidden="true">
        <ellipse className="dog-runner__shadow" cx="32" cy="45" rx="17" ry="3" />
        <g className="dog-runner__bob">
          <path className="dog-runner__tail" d="M16 22C9 20 5 13 9 7" />
          <ellipse className="dog-runner__body" cx="31" cy="25" rx="17" ry="10" />
          <circle className="dog-runner__head" cx="47" cy="18" r="9" />
          <path className="dog-runner__ear" d="M42 11L46 2L51 11Z" />
          <rect className="dog-runner__snout" x="52" y="17" width="9" height="6" rx="3" />
          <circle className="dog-runner__nose" cx="59" cy="19" r="1.6" />
          <circle className="dog-runner__eye" cx="49" cy="15" r="1.7" />
          <path className="dog-runner__collar" d="M41 24L44 30" />
          <g className="dog-runner__leg dog-runner__leg--a">
            <path d="M21 32L19 43" />
          </g>
          <g className="dog-runner__leg dog-runner__leg--b">
            <path d="M28 33L27 44" />
          </g>
          <g className="dog-runner__leg dog-runner__leg--c">
            <path d="M37 33L39 44" />
          </g>
          <g className="dog-runner__leg dog-runner__leg--d">
            <path d="M44 32L47 43" />
          </g>
        </g>
      </svg>
    </span>
  );
}
