import { describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import { UserText } from "@/components/userText";
import { AssistantText } from "@/components/assistantText";
import { SwitchBox, VerticalSwitchBox } from "@/components/switchBox";

// Mock config
vi.mock("@/utils/config", () => ({
  config: vi.fn((key: string) => {
    if (key === "name") return "Amica";
    return "";
  }),
}));

/**
 * Text Component Snapshot Tests
 */

describe("Text Components", () => {
  describe("UserText", () => {
    test("should match snapshot with simple message", () => {
      const { container } = render(
        <UserText message="Hello, how are you?" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with emotion tags removed", () => {
      const { container } = render(
        <UserText message="[happy] I'm feeling great today!" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with multiple emotion tags", () => {
      const { container } = render(
        <UserText message="[excited] This is [amazing] news!" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with long message", () => {
      const longMessage = "This is a very long message that should test the overflow behavior and ensure that the component handles long text properly without breaking the layout.";
      const { container } = render(
        <UserText message={longMessage} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with empty message", () => {
      const { container } = render(
        <UserText message="" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with special characters", () => {
      const { container } = render(
        <UserText message="Hello! 👋 How are you? 🎉" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("AssistantText", () => {
    test("should match snapshot with simple message", () => {
      const { container } = render(
        <AssistantText message="I'm doing well, thank you!" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with emotion tags removed", () => {
      const { container } = render(
        <AssistantText message="[neutral] Let me help you with that." />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with long message", () => {
      const longMessage = "This is a comprehensive response that provides detailed information about the topic you asked about. It should demonstrate how the component handles longer text content.";
      const { container } = render(
        <AssistantText message={longMessage} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with multiple emotion tags", () => {
      const { container} = render(
        <AssistantText message="[thinking] Let me [neutral] consider that." />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with code-like content", () => {
      const { container } = render(
        <AssistantText message="Here's the code: console.log('Hello');" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with markdown-like content", () => {
      const { container } = render(
        <AssistantText message="**Bold text** and *italic text*" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("SwitchBox", () => {
    const mockOnChange = vi.fn();

    test("should match snapshot when enabled", () => {
      const { container } = render(
        <SwitchBox
          value={true}
          label="Enable Feature"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot when disabled state", () => {
      const { container } = render(
        <SwitchBox
          value={false}
          label="Enable Feature"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot when disabled prop is true", () => {
      const { container } = render(
        <SwitchBox
          value={true}
          label="Disabled Feature"
          onChange={mockOnChange}
          disabled={true}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with long label", () => {
      const { container } = render(
        <SwitchBox
          value={true}
          label="This is a very long label that might wrap to multiple lines"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with short label", () => {
      const { container } = render(
        <SwitchBox
          value={false}
          label="On"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("VerticalSwitchBox", () => {
    const mockOnChange = vi.fn();

    test("should match snapshot when enabled", () => {
      const { container } = render(
        <VerticalSwitchBox
          value={true}
          label="Vertical Option"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot when disabled", () => {
      const { container } = render(
        <VerticalSwitchBox
          value={false}
          label="Vertical Option"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with long label", () => {
      const { container } = render(
        <VerticalSwitchBox
          value={true}
          label="A very long vertical label"
          onChange={mockOnChange}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
