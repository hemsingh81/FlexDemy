import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExerciseRunner } from '../../../src/features/CoursePlayer/ExerciseRunner';

describe('ExerciseRunner', () => {
  it('renders genuinely inline -- not inside a SidePanel/dialog/portal', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="subtopic_2" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a radio input per option for a multipleChoice exercise', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="subtopic_2" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a plain text input for a numeric exercise', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="subtopic_1" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    const input = screen.getByLabelText('Your answer') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('renders a plain text input for a shortText exercise', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="topic_1" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    const input = screen.getByLabelText('Your answer') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('submitting shows feedback inline without unmounting the question', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="subtopic_1" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    const questionText = screen.getByText(/wavelength/i).textContent;

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Answer' }));

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText(questionText!)).toBeInTheDocument();
  });

  it('shows the worked-solution framing (not error styling) for an incorrect submission', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="subtopic_1" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Answer' }));

    expect(screen.getByText("Here's the worked solution")).toBeInTheDocument();
  });

  it('a node with no exercise renders nothing from this component at all', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="does_not_exist" />);

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(screen.queryByTestId('exercise-runner')).not.toBeInTheDocument();
  });

  it('the submit button is disabled until an answer is entered', async () => {
    render(<ExerciseRunner courseId="course_1" nodeId="subtopic_1" />);

    await waitFor(() => expect(screen.getByTestId('exercise-runner')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Submit Answer' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '3' } });

    expect(screen.getByRole('button', { name: 'Submit Answer' })).not.toBeDisabled();
  });
});
