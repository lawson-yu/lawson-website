"use client";

import Image from "next/image";
import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";
import { cancelPageScroll, createShowcaseMotion, revealProcess, scrollPageTo } from "./showcase-motion";
import "./work-services.css";

export type ProcessStage = {
  title: string;
  chartLabel: string;
  phase: string;
  description: string;
};

export type ServiceCard = {
  kind: "design" | "frontend" | "fullstack" | "agent";
  title: string;
  description: string;
  alt: string;
};

type WorkServicesProps = {
  processTitle: string;
  processTitleAccent: string;
  processDescription: string;
  processChartLabel: string;
  processChartNote: string;
  stages: ProcessStage[];
  timeline: string[];
  servicesTitle: string;
  servicesTitleAccent: string;
  servicesDescription: string;
  services: ServiceCard[];
};

export function WorkServices({
  processTitle,
  processTitleAccent,
  processDescription,
  processChartLabel,
  processChartNote,
  stages,
  timeline,
  servicesTitle,
  servicesTitleAccent,
  servicesDescription,
  services,
}: WorkServicesProps) {
  const processLines = processDescription.split("\n");
  const processSection = useRef<HTMLElement>(null);
  const servicesSection = useRef<HTMLElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const process = processSection.current;
    const service = servicesSection.current;
    const track = service?.querySelector<HTMLElement>(".work-services__track");
    if (!process || !service || !track) return;

    const disposeProcess = revealProcess(process);
    const controller = createShowcaseMotion(
      service,
      track,
      () => {},
      (top, immediate) => scrollPageTo(lenis, top, immediate),
      () => cancelPageScroll(lenis),
    );
    return () => {
      disposeProcess();
      controller.dispose();
    };
  }, [lenis, services.length]);

  return (
    <>
      <section
        ref={processSection}
        data-screen="process"
        data-home-motion="process"
        className="work-services__process home-process"
        aria-labelledby="process-title"
      >
        <div className="work-services__viewport">
          <div className="work-services__inner">
            <div className="work-services__intro">
              <h2 id="process-title">{processTitle}<span>{processTitleAccent}</span></h2>
              <p>
                {processLines.map((line, index) => (
                  <span key={line}>
                    {index > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            </div>
            <div className="work-services__chart" role="img" aria-label={processChartLabel}>
              {stages.map((stage, index) => (
                <div className={`work-services__chart-row work-services__chart-row--${index + 1}`} key={stage.title}>
                  <span style={{ "--reveal-index": index } as React.CSSProperties}>{stage.chartLabel}</span>
                </div>
              ))}
              <div className="work-services__timeline" aria-hidden="true">
                {timeline.map((label) => <span key={label}>{label}</span>)}
              </div>
            </div>
            <p className="work-services__chart-note">{processChartNote}</p>
            <div className="work-services__stages">
              {stages.map((stage, index) => (
                <article className="work-services__stage" key={stage.title} style={{ "--reveal-index": index } as React.CSSProperties}>
                  <span className="work-services__stage-number">0{index + 1} / {stage.phase}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section
        ref={servicesSection}
        data-screen="services"
        data-home-motion="services"
        id="services"
        className="work-services__services"
        style={{ "--service-height": `${services.length * 100 - 25}vh` } as React.CSSProperties}
        aria-labelledby="services-title"
      >
        <div className="work-services__viewport">
          <div className="work-services__inner">
            <div className="work-services__services-intro">
              <h2 id="services-title">{servicesTitle}<br /><span>{servicesTitleAccent}</span></h2>
              <p>{servicesDescription}</p>
            </div>
            <div className="work-services__showcase">
              <div className="work-services__track">
                {services.map((service) => (
                  <article className="work-services__service" key={service.kind}>
                    <div className="work-services__visual">
                      <Image src={`/images/services/${service.kind}.jpg`} alt={service.alt} fill sizes="(max-width: 767px) 60vw, 30vw" />
                      <span className="work-services__visual-label" aria-hidden="true">{service.title}</span>
                    </div>
                    <div className="work-services__service-copy">
                      <h3>{service.title}</h3>
                      <p>{service.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
