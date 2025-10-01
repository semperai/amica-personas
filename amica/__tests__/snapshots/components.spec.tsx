import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react";
import { IconButton } from "@/components/iconButton";
import { TextButton } from "@/components/textButton";

/**
 * Component Snapshot Tests
 *
 * These tests capture the rendered output of components and detect unintended changes.
 * If a snapshot fails, review the changes and update with `npm test -- -u` if intended.
 */

describe("Button Components", () => {
  describe("IconButton", () => {
    test("should match snapshot with default props", () => {
      const { container } = render(
        <IconButton
          iconName="24/Menu"
          isProcessing={false}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot when processing", () => {
      const { container } = render(
        <IconButton
          iconName="24/Menu"
          isProcessing={true}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with label", () => {
      const { container } = render(
        <IconButton
          iconName="24/Menu"
          isProcessing={false}
          label="Click Me"
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot when disabled", () => {
      const { container } = render(
        <IconButton
          iconName="24/Menu"
          isProcessing={false}
          disabled
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with custom className", () => {
      const { container } = render(
        <IconButton
          iconName="24/Settings"
          isProcessing={false}
          className="custom-class"
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with processing and label", () => {
      const { container } = render(
        <IconButton
          iconName="24/Send"
          isProcessing={true}
          label="Sending"
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe("TextButton", () => {
    test("should match snapshot with text", () => {
      const { container } = render(
        <TextButton>Click Me</TextButton>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot when disabled", () => {
      const { container } = render(
        <TextButton disabled>Disabled Button</TextButton>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with custom className", () => {
      const { container } = render(
        <TextButton className="my-custom-class">
          Custom Button
        </TextButton>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with onClick handler", () => {
      const handleClick = jest.fn();
      const { container } = render(
        <TextButton onClick={handleClick}>
          Submit
        </TextButton>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with type submit", () => {
      const { container } = render(
        <TextButton type="submit">
          Submit Form
        </TextButton>
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    test("should match snapshot with long text", () => {
      const { container } = render(
        <TextButton>
          This is a very long button text that might wrap
        </TextButton>
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
